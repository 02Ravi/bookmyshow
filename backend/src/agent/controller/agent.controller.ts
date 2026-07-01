import { Body, Controller, Post } from '@nestjs/common';
import { type ModelMessage } from 'ai';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../../auth/service/auth.service';
import { BookingService } from '../../booking/service/booking.service';
import { CatalogService } from '../../catalog/service/catalog.service';
import { ReservationService } from '../../reservation/service/reservation.service';
import { buildSystemPrompt } from '../scout/buildSystemPrompt';
import { enrichToolCalls } from '../scout/enrichToolCalls';
import { runAgentLoop } from '../scout/agentLoop';
import {
  DATE_MESSAGE_PATTERN,
  UUID_PATTERN,
} from '../scout/promptBuilders';
import { AgentChatDto } from '../dto/agent-chat.dto';
import {
  AgentSession,
  AgentStoredMessage,
  SessionService,
} from '../session/session.service';

interface AgentChatResponse {
  text: string;
  toolCalls: unknown[];
  sessionId: string;
  redirectTo?: string;
}

@Controller('agent')
export class AgentController {
  constructor(
    private readonly auth: AuthService,
    private readonly booking: BookingService,
    private readonly catalog: CatalogService,
    private readonly reservation: ReservationService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('chat')
  async chat(@Body() dto: AgentChatDto): Promise<AgentChatResponse> {
    const { sessionId, session, loopResult } = await this.runTurn(dto);
    const enriched = await enrichToolCalls({
      loopResult,
      session,
      lastUserMessage: dto.message,
      catalog: this.catalog,
      reservation: this.reservation,
      booking: this.booking,
      sessionId,
    });
    const { text, redirectTo } = extractRedirect(enriched.text);

    session.messages.push({ role: 'assistant', content: text });
    await this.sessionService.saveSession(sessionId, session);

    return {
      text,
      toolCalls: filterClientToolCalls(enriched.toolCalls),
      sessionId,
      redirectTo,
    };
  }

  private async runTurn(dto: AgentChatDto) {
    const { sessionId, session } = await this.prepareSession(dto);
    const loopResult = await runAgentLoop({
      instructions: buildSystemPrompt(session),
      messages: toCoreMessages(session.messages),
      ctx: this.buildLoopContext(session, sessionId),
    });

    return { sessionId, session, loopResult };
  }

  private async prepareSession(dto: AgentChatDto): Promise<{
    sessionId: string;
    session: AgentSession;
  }> {
    const sessionId = dto.sessionId ?? randomUUID();
    const session =
      (await this.sessionService.getSession(sessionId)) ??
      this.sessionService.createEmptySession();

    if (dto.identity?.userId && !session.userId) {
      session.userId = dto.identity.userId;
      session.name = dto.identity.name ?? null;
      session.email = dto.identity.email ?? null;
      session.phone = dto.identity.phone ?? null;
    }

    this.applyUserMessageToSession(session, dto.message);
    session.messages.push({ role: 'user', content: dto.message });

    return { sessionId, session };
  }

  private applyUserMessageToSession(
    session: AgentSession,
    message: string,
  ): void {
    const trimmed = message.trim();

    if (DATE_MESSAGE_PATTERN.test(trimmed)) {
      session.selectedDate = trimmed;
      session.showId = null;
      return;
    }

    if (UUID_PATTERN.test(trimmed) && session.movieId !== trimmed) {
      session.selectedDate = null;
    }
  }

  private buildLoopContext(session: AgentSession, sessionId: string) {
    return {
      auth: this.auth,
      booking: this.booking,
      catalog: this.catalog,
      reservation: this.reservation,
      session,
      sessionId,
    };
  }
}

function toCoreMessages(messages: AgentStoredMessage[]): ModelMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

const CLIENT_HIDDEN_TOOLS = new Set(['listMovies', 'listShows', 'getSeatMap']);

function filterValidToolCalls(toolCalls: unknown[]): unknown[] {
  return toolCalls.filter((toolCall) => {
    if (typeof toolCall !== 'object' || toolCall === null) {
      return true;
    }
    return !('invalid' in toolCall && (toolCall as { invalid?: boolean }).invalid);
  });
}

function filterClientToolCalls(toolCalls: unknown[]): unknown[] {
  return filterValidToolCalls(toolCalls).filter((toolCall) => {
    if (typeof toolCall !== 'object' || toolCall === null) {
      return true;
    }

    const record = toolCall as { toolName?: string; name?: string };
    const toolName = record.toolName ?? record.name;
    if (typeof toolName !== 'string') {
      return true;
    }

    return !CLIENT_HIDDEN_TOOLS.has(toolName);
  });
}

function extractRedirect(text: string): {
  text: string;
  redirectTo?: string;
} {
  const match = text.match(/REDIRECT:(\/booking\/[A-Za-z0-9-]+)/);
  if (!match) {
    return { text };
  }

  const cleaned = text.replace(match[0], '').trim();
  return {
    text: cleaned,
    redirectTo: match[1],
  };
}
