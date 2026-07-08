import { Injectable } from '@nestjs/common';
import {
  AGENT_SESSION_TTL_SECONDS,
  AGENT_TURN_LOCK_TTL_SECONDS,
} from '../../common/constants';
import { agentLockKey, agentSessionKey } from '../../common/redis.keys';
import { RedisService } from '../../redis/redis.service';

export interface AgentStoredMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentSession {
  userId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  movieId: string | null;
  selectedDate: string | null;
  reservationId: string | null;
  showId: string | null;
  pendingCancelBookingId: string | null;
  /** True after cancel picker is shown; cleared when user picks a booking or changes intent. */
  awaitingCancelBookingPick: boolean;
  /** JSON array of seatLabels awaiting profile before hold. */
  pendingShowSeatIds: string | null;
  messages: AgentStoredMessage[];
}

const EMPTY_SESSION: AgentSession = {
  userId: null,
  name: null,
  email: null,
  phone: null,
  movieId: null,
  selectedDate: null,
  reservationId: null,
  showId: null,
  pendingCancelBookingId: null,
  awaitingCancelBookingPick: false,
  pendingShowSeatIds: null,
  messages: [],
};

@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisService) {}

  createEmptySession(): AgentSession {
    return { ...EMPTY_SESSION, messages: [] };
  }

  async getSession(sessionId: string): Promise<AgentSession | null> {
    const values = await this.redis.getClient().hgetall(this.getKey(sessionId));
    if (Object.keys(values).length === 0) {
      return null;
    }

    return {
      userId: values.userId || null,
      name: values.name || null,
      email: values.email || null,
      phone: values.phone || null,
      movieId: values.movieId || null,
      selectedDate: values.selectedDate || null,
      reservationId: values.reservationId || null,
      showId: values.showId || null,
      pendingCancelBookingId: values.pendingCancelBookingId || null,
      awaitingCancelBookingPick: values.awaitingCancelBookingPick === '1',
      pendingShowSeatIds: values.pendingShowSeatIds || null,
      messages: this.parseMessages(values.messages),
    };
  }

  async saveSession(sessionId: string, session: AgentSession): Promise<void> {
    const key = this.getKey(sessionId);
    await this.redis.getClient().hset(key, {
      userId: session.userId ?? '',
      name: session.name ?? '',
      email: session.email ?? '',
      phone: session.phone ?? '',
      movieId: session.movieId ?? '',
      selectedDate: session.selectedDate ?? '',
      reservationId: session.reservationId ?? '',
      showId: session.showId ?? '',
      pendingCancelBookingId: session.pendingCancelBookingId ?? '',
      awaitingCancelBookingPick: session.awaitingCancelBookingPick ? '1' : '',
      pendingShowSeatIds: session.pendingShowSeatIds ?? '',
      messages: JSON.stringify(session.messages),
    });
    await this.redis.getClient().expire(key, AGENT_SESSION_TTL_SECONDS);
  }

  async acquireTurnLock(
    sessionId: string,
    ttlSeconds = AGENT_TURN_LOCK_TTL_SECONDS,
  ): Promise<boolean> {
    const result = await this.redis
      .getClient()
      .set(this.getLockKey(sessionId), '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseTurnLock(sessionId: string): Promise<void> {
    await this.redis.getClient().del(this.getLockKey(sessionId));
  }

  private getKey(sessionId: string): string {
    return agentSessionKey(sessionId);
  }

  private getLockKey(sessionId: string): string {
    return agentLockKey(sessionId);
  }

  private parseMessages(raw: string | undefined): AgentStoredMessage[] {
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as AgentStoredMessage[];
      return Array.isArray(parsed)
        ? parsed.filter(
            (message) =>
              (message.role === 'user' || message.role === 'assistant') &&
              typeof message.content === 'string',
          )
        : [];
    } catch {
      return [];
    }
  }
}
