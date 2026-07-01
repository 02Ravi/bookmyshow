'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Loader2, X } from 'lucide-react';
import { Markdown } from '@/components/ui/Markdown';
import { cn } from '@/lib/utils';
import { ChatMessage, UiBlock, isInteractiveBlock, isTextBlock } from '@/types/agent';
import { BookingAgentChoiceGroup } from './BookingAgentChoiceGroup';
import { BookingAgentConfirmBlock } from './BookingAgentConfirmBlock';
import { BookingAgentProfileForm } from './BookingAgentProfileForm';
import { BookingAgentSeatPicker } from './BookingAgentSeatPicker';

interface BookingAgentChatPanelProps {
  inputLocked: boolean;
  isOpen: boolean;
  loading: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onSend: (text: string, answerMessageId?: string, displayContent?: string) => void | Promise<void>;
}

const EMPTY_STATE_PROMPTS = [
  'What movies are playing today?',
  'Book 2 premium seats for Interstellar tonight',
  'Show me my upcoming bookings',
  'Cancel my current seat hold',
];

function messageHasInteractiveBlocks(blocks: UiBlock[]): boolean {
  return blocks.some(isInteractiveBlock);
}

function MessageBlock({
  answerMessageId,
  block,
  disabled,
  onSend,
}: {
  answerMessageId: string;
  block: UiBlock;
  disabled: boolean;
  onSend: (
    text: string,
    answerMessageId?: string,
    displayContent?: string,
  ) => void | Promise<void>;
}) {
  if (block.type === 'markdown') {
    return (
      <div className="bms-agent-card">
        <p className="bms-agent-card-label mb-2">Assistant</p>
        <Markdown compact dense className="text-sm">
          {block.markdown}
        </Markdown>
      </div>
    );
  }

  if (block.type === 'choice_group') {
    return (
      <BookingAgentChoiceGroup
        choices={block.choices}
        disabled={disabled}
        message={block.message}
        mode={block.mode}
        presentation={block.presentation}
        onConfirm={(value) => {
          const label =
            block.choices.find((c) => c.value === value)?.label ?? 'your selection';
          void onSend(value, answerMessageId, label);
        }}
      />
    );
  }

  if (block.type === 'confirm') {
    return (
      <BookingAgentConfirmBlock
        choices={block.choices}
        disabled={disabled}
        message={block.message}
        onConfirm={(value) => {
          const label =
            block.choices?.find((c) => c.value === value)?.label ??
            (value === 'confirm' ? 'Confirm' : 'Cancel');
          void onSend(value, answerMessageId, label);
        }}
      />
    );
  }

  if (block.type === 'seat_picker') {
    return (
      <BookingAgentSeatPicker
        disabled={disabled}
        maxSelections={block.maxSelections}
        message={block.message}
        onConfirm={(value) => void onSend(value, answerMessageId, 'Selected seats')}
        seats={block.seats}
      />
    );
  }

  if (block.type === 'profile_form') {
    return (
      <BookingAgentProfileForm
        disabled={disabled}
        message={block.message}
        onConfirm={(value, displayContent) =>
          void onSend(value, answerMessageId, displayContent)
        }
      />
    );
  }

  return <p className="whitespace-pre-wrap text-sm leading-6">{block.content}</p>;
}

export function BookingAgentChatPanel({
  inputLocked,
  isOpen,
  loading,
  messages,
  onClose,
  onSend,
}: BookingAgentChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerDisabled = loading || inputLocked;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading]);

  function submit() {
    const message = input.trim();
    if (!message || composerDisabled) return;
    setInput('');
    void onSend(message);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-[var(--bms-chat-border)] bg-[var(--bms-chat-surface)] shadow-xl md:w-[420px]">
      <div className="flex items-center justify-between border-b border-[var(--bms-chat-border)] px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[var(--bms-text)]">Booking Assistant</span>
          <span className="text-xs text-[var(--bms-text-muted)]">
            Book tickets or manage your hold from chat.
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-[var(--bms-text-muted)] transition hover:bg-[var(--bms-chat-muted)]"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 ? (
          <div className="text-xs text-[var(--bms-text-muted)]">
            Ask me to help you book a ticket. For example:
            <ul className="mt-2 list-inside list-disc space-y-1">
              {EMPTY_STATE_PROMPTS.map((prompt) => (
                <li key={prompt}>{prompt}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((message) => {
          const isUser = message.role === 'user';
          const hasInteractive =
            message.role === 'assistant' && messageHasInteractiveBlocks(message.blocks);
          const textBlocks = message.blocks.filter(
            (block): block is Extract<UiBlock, { type: 'text' }> =>
              isTextBlock(block) && block.content.trim().length > 0,
          );
          const otherBlocks = message.blocks.filter((b) => b.type !== 'text');
          const interactiveBlocks = otherBlocks.filter(isInteractiveBlock);
          const visibleBlocks =
            interactiveBlocks.length > 1
              ? [
                  ...otherBlocks.filter((block) => !isInteractiveBlock(block)),
                  interactiveBlocks[interactiveBlocks.length - 1],
                ]
              : otherBlocks;

          return (
            <div
              key={message.id}
              className={cn(
                isUser
                  ? 'ml-auto max-w-[90%] space-y-2'
                  : 'mr-auto w-full max-w-[95%] space-y-2',
              )}
            >
              {!isUser && hasInteractive ? null : textBlocks.length > 0 ? (
                <div
                  className={cn(
                    'whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                    isUser
                      ? 'bg-[var(--bms-chat-user)] text-white'
                      : 'bg-[var(--bms-chat-assistant)] text-[var(--bms-text)]',
                  )}
                >
                  {isUser ? (
                    message.displayContent ??
                    textBlocks.map((b) => b.content).join('\n')
                  ) : (
                    <Markdown compact dense>
                      {textBlocks.map((b) => b.content).join('\n')}
                    </Markdown>
                  )}
                </div>
              ) : null}

              {visibleBlocks.map((block, index) => (
                <MessageBlock
                  key={`${message.id}-${block.type}-${index}`}
                  answerMessageId={message.id}
                  block={block}
                  disabled={loading}
                  onSend={onSend}
                />
              ))}
            </div>
          );
        })}

        {loading &&
        !messages.some(
          (message) =>
            message.role === 'assistant' &&
            message.blocks.some(
              (block) => block.type === 'text' && block.content.trim().length > 0,
            ),
        ) ? (
          <div className="flex items-center gap-2 text-xs text-[var(--bms-text-muted)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--bms-text-muted)]" />
            <span className="inline-flex items-center gap-1">
              Thinking…
              <span className="inline-flex gap-0.5">
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--bms-text-muted)]/50"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--bms-text-muted)]/50"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--bms-text-muted)]/50"
                  style={{ animationDelay: '300ms' }}
                />
              </span>
            </span>
          </div>
        ) : null}

        <div ref={scrollRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-[var(--bms-chat-border)] px-3 py-2"
      >
        <div className="relative">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            disabled={composerDisabled}
            placeholder={
              inputLocked
                ? 'Choose an option above to continue…'
                : 'Ask to book, hold, or show your bookings...'
            }
            className="w-full resize-none rounded-md border border-[var(--bms-chat-border)] bg-[var(--bms-chat-muted)] px-3 py-3 pr-10 text-sm outline-none transition placeholder:text-[var(--bms-text-muted)] focus:border-[var(--bms-red)] focus:ring-1 focus:ring-[var(--bms-red)]/20 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--bms-text-muted)]" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-[var(--bms-text-muted)]" />
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[var(--bms-text-muted)]">
          Press Enter to send · Shift+Enter for a new line
        </p>
      </form>
    </aside>
  );
}
