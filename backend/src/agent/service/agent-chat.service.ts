import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { type ModelMessage } from 'ai';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../../auth/service/auth.service';
import { BookingService } from '../../booking/service/booking.service';
import { CatalogService } from '../../catalog/service/catalog.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationService } from '../../reservation/service/reservation.service';
import { buildSystemPrompt } from '../scout/buildSystemPrompt';
import { enrichToolCalls } from '../scout/enrichToolCalls';
import { runAgentLoop } from '../scout/agentLoop';
import {
  DATE_MESSAGE_PATTERN,
  UUID_PATTERN,
  parseProfileMessage,
} from '../scout/promptBuilders';
import { AgentChatDto } from '../dto/agent-chat.dto';
import {
  reconcileClientIdentity,
  toSessionIdentity,
  upsertProfileIntoSession,
} from '../session/resolveSessionIdentity';
import {
  AgentSession,
  AgentStoredMessage,
  SessionService,
} from '../session/session.service';

export interface AgentChatResponse {
  text: string;
  toolCalls: unknown[];
  sessionId: string;
  redirectTo?: string;
  sessionIdentity?: {
    userId: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

const CLIENT_HIDDEN_TOOLS = new Set([
  'listMovies',
  'listShows',
  'getSeatMap',
  'listBookings',
  'getBooking',
]);

@Injectable()
export class AgentChatService {
  constructor(
    private readonly auth: AuthService,
    private readonly booking: BookingService,
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
    private readonly reservation: ReservationService,
    private readonly sessionService: SessionService,
  ) {}

  async handleChat(dto: AgentChatDto): Promise<AgentChatResponse> {
    const requestSessionId = dto.sessionId ?? randomUUID();
    const lockAcquired =
      await this.sessionService.acquireTurnLock(requestSessionId);

    if (!lockAcquired) {
      throw new HttpException(
        'Previous message still processing, please wait',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const { sessionId, session, loopResult } = await this.runTurn({
        ...dto,
        sessionId: requestSessionId,
      });
      const enriched = await enrichToolCalls({
        loopResult,
        session,
        lastUserMessage: dto.message,
        catalog: this.catalog,
        reservation: this.reservation,
        booking: this.booking,
        auth: this.auth,
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
        sessionIdentity: toSessionIdentity(session),
      };
    } finally {
      await this.sessionService.releaseTurnLock(requestSessionId);
    }
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

    await reconcileClientIdentity(
      session,
      dto.identity,
      this.auth,
      this.prisma,
    );

    const profile = parseProfileMessage(dto.message);
    if (profile) {
      await upsertProfileIntoSession(session, profile, this.auth);
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

function filterValidToolCalls(toolCalls: unknown[]): unknown[] {
  return toolCalls.filter((toolCall) => {
    if (typeof toolCall !== 'object' || toolCall === null) {
      return true;
    }
    return !(
      'invalid' in toolCall && (toolCall as { invalid?: boolean }).invalid
    );
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
