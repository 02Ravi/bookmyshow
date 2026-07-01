'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import {
  AgentIdentityPayload,
  AgentToolCall,
  sendAgentMessage,
} from '@/lib/agent-api';
import { extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  ChatMessage,
  ChoiceOption,
  UiBlock,
  isInteractiveBlock,
} from '@/types/agent';

interface ChoiceGroupInput {
  type: 'choice_group';
  message: string;
  mode?: 'single' | 'multi';
  presentation?: 'dropdown' | 'radio' | 'checkbox' | 'chips';
  choices: ChoiceOption[];
}

interface ConfirmInput {
  type: 'confirm';
  message: string;
  choices?: ChoiceOption[];
}

interface SeatPickerInput {
  type: 'seat_picker';
  message: string;
  seats: Array<{
    showSeatId: string;
    row: string;
    number: number;
    type: string;
    status: 'AVAILABLE' | 'HELD' | 'BOOKED';
    price: number;
  }>;
  maxSelections?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseChoices(value: unknown): ChoiceOption[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (choice): choice is ChoiceOption =>
      isRecord(choice) &&
      typeof choice.label === 'string' &&
      typeof choice.value === 'string',
  );
}

function isChoiceGroupInput(value: unknown): value is ChoiceGroupInput {
  if (!isRecord(value)) return false;
  return value.type === 'choice_group' && typeof value.message === 'string';
}

function isConfirmInput(value: unknown): value is ConfirmInput {
  if (!isRecord(value)) return false;
  return value.type === 'confirm' && typeof value.message === 'string';
}

function isSeatPickerInput(value: unknown): value is SeatPickerInput {
  if (!isRecord(value)) return false;
  return value.type === 'seat_picker' && typeof value.message === 'string';
}

function parseToolBlocks(toolCalls: AgentToolCall[]): UiBlock[] {
  const blocks: UiBlock[] = [];

  for (const toolCall of toolCalls) {
    if (toolCall.toolName === 'uiMarkdown' && isRecord(toolCall.input)) {
      const markdown = toolCall.input.markdown;
      if (typeof markdown === 'string' && markdown.trim()) {
        blocks.push({ type: 'markdown', markdown });
      }
    }

    if (toolCall.toolName === 'uiPrompt' && isChoiceGroupInput(toolCall.input)) {
      blocks.push({
        type: 'choice_group',
        message: toolCall.input.message,
        mode: toolCall.input.mode ?? 'single',
        presentation: toolCall.input.presentation ?? 'dropdown',
        choices: parseChoices(toolCall.input.choices),
      });
    }

    if (toolCall.toolName === 'uiPrompt' && isConfirmInput(toolCall.input)) {
      blocks.push({
        type: 'confirm',
        message: toolCall.input.message,
        choices: parseChoices(toolCall.input.choices),
      });
    }

    if (toolCall.toolName === 'uiPrompt' && isSeatPickerInput(toolCall.input)) {
      blocks.push({
        type: 'seat_picker',
        message: toolCall.input.message,
        seats: toolCall.input.seats,
        maxSelections: toolCall.input.maxSelections ?? 0,
      });
    }
  }

  return blocks;
}

function keepLastInteractiveBlock(blocks: UiBlock[]): UiBlock[] {
  const interactiveIndexes = blocks
    .map((block, index) => (isInteractiveBlock(block) ? index : -1))
    .filter((index) => index >= 0);

  if (interactiveIndexes.length <= 1) {
    return blocks;
  }

  const lastInteractiveIndex = interactiveIndexes[interactiveIndexes.length - 1];
  return blocks.filter(
    (block, index) => !isInteractiveBlock(block) || index === lastInteractiveIndex,
  );
}

function buildAssistantBlocks(text: string, toolCalls: AgentToolCall[]): UiBlock[] {
  const blocks = parseToolBlocks(toolCalls);
  const hasInteractive = blocks.some(isInteractiveBlock);
  const trimmed = text.trim();

  if (trimmed && !hasInteractive) {
    blocks.unshift({ type: 'text', content: trimmed });
  }

  return keepLastInteractiveBlock(blocks);
}

export function useBookingAgent() {
  const router = useRouter();
  const userId = useAuthStore((state) => state.userId);
  const name = useAuthStore((state) => state.name);
  const email = useAuthStore((state) => state.email);
  const phone = useAuthStore((state) => state.phone);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [answeredMessageIds, setAnsweredMessageIds] = useState<Set<string>>(
    () => new Set(),
  );

  const inputLocked = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return false;
    const hasInteractive = lastAssistant.blocks.some(isInteractiveBlock);
    if (!hasInteractive) return false;
    return !answeredMessageIds.has(lastAssistant.id);
  }, [answeredMessageIds, messages]);

  const sendMessage = useCallback(
    async (text: string, answerMessageId?: string, displayContent?: string) => {
      const content = text.trim();
      if (!content || loading) return;

      if (answerMessageId) {
        setAnsweredMessageIds((current) => new Set(current).add(answerMessageId));
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'user',
          blocks: [{ type: 'text', content }],
          ...(displayContent ? { displayContent } : {}),
        },
      ]);
      setLoading(true);

      try {
        const identity: AgentIdentityPayload | undefined =
          messages.length === 0 && !sessionId && userId
            ? { userId, name, email, phone }
            : undefined;

        const data = await sendAgentMessage(
          content,
          sessionId ?? undefined,
          identity,
        );

        const blocks = buildAssistantBlocks(data.text, data.toolCalls);

        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            blocks,
          },
        ]);
        setSessionId(data.sessionId);

        if (data.redirectTo) {
          router.push(data.redirectTo);
        }
      } catch (error) {
        const message = extractApiError(
          error,
          'Something went wrong. Please try again.',
        );

        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            blocks: [{ type: 'text', content: `Sorry, I couldn't process that: ${message}` }],
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [email, loading, messages.length, name, phone, router, sessionId, userId],
  );

  return {
    messages,
    loading,
    inputLocked,
    sendMessage,
  };
}
