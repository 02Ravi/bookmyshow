import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { HOLD_TTL_SECONDS } from '../../common/constants';
import { computeSeatsForScreen } from '../../catalog/util/computeSeatsForScreen';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { RedisService } from '../../redis/redis.service';
import { holdTokenKey, showHoldsKey } from '../../common/redis.keys';

/**
 * Atomic all-or-nothing seat hold.
 *
 * KEYS[1] = show:{showId}:holds
 * ARGV[1] = nowMs
 * ARGV[2] = expiryMs
 * ARGV[3..N] = seatLabels
 *
 * For every seatLabel: if ZSCORE exists and is still > nowMs, abort (return 0).
 * Otherwise ZADD all members with score = expiryMs and return 1.
 */
const TRY_HOLD_SEATS_LUA = `
local nowMs = tonumber(ARGV[1])
local expiryMs = tonumber(ARGV[2])
for i = 3, #ARGV do
  local score = redis.call('ZSCORE', KEYS[1], ARGV[i])
  if score and tonumber(score) > nowMs then
    return 0
  end
end
for i = 3, #ARGV do
  redis.call('ZADD', KEYS[1], expiryMs, ARGV[i])
end
return 1
`;

export interface HoldTokenData {
  showId: string;
  seatLabels: string[];
  userId: string;
  expiresAt: string;
}

export interface CreateHoldParams {
  userId: string;
  showId: string;
  seatLabels: string[];
  holdDurationSeconds?: number;
}

export interface HoldResult {
  token: string;
  showId: string;
  seatLabels: string[];
  expiresAt: Date;
  userId: string;
}

@Injectable()
export class HoldService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Validate seats, atomically hold them in Redis, issue a hold token, and emit
   * seat-held events. Used by HoldController and the AI agent enricher.
   */
  async createHold(params: CreateHoldParams): Promise<HoldResult> {
    const show = await this.prisma.show.findUnique({
      where: { id: params.showId },
      include: { screen: true },
    });
    if (!show) {
      throw new NotFoundException(`Show ${params.showId} not found`);
    }

    const allSeats = computeSeatsForScreen(
      show.screen.layoutConfig,
      Number(show.basePrice),
    );
    const validLabels = new Set(allSeats.map((s) => s.seatLabel));
    const invalid = params.seatLabels.filter((l) => !validLabels.has(l));
    if (invalid.length > 0) {
      throw new NotFoundException(
        `Unknown seat label(s) for this show: ${invalid.join(', ')}`,
      );
    }

    const booked = await this.prisma.bookedSeat.findMany({
      where: {
        showId: params.showId,
        seatLabel: { in: params.seatLabels },
      },
      select: { seatLabel: true },
    });
    if (booked.length > 0) {
      throw new ConflictException(
        `One or more seats are already booked: ${booked.map((b) => b.seatLabel).join(', ')}`,
      );
    }

    const ttlSeconds = params.holdDurationSeconds ?? HOLD_TTL_SECONDS;
    const held = await this.tryHoldSeats(
      params.showId,
      params.seatLabels,
      ttlSeconds,
    );
    if (!held) {
      throw new ConflictException('One or more seats are not available');
    }

    const token = randomUUID();
    await this.createHoldToken(
      token,
      params.showId,
      params.seatLabels,
      params.userId,
      ttlSeconds,
    );

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    for (const seatLabel of params.seatLabels) {
      this.realtime.emitSeatHeld(params.showId, seatLabel, token);
    }

    return {
      token,
      showId: params.showId,
      seatLabels: params.seatLabels,
      expiresAt,
      userId: params.userId,
    };
  }

  async releaseHold(token: string): Promise<void> {
    const data = await this.resolveHoldToken(token);
    if (!data) {
      throw new NotFoundException(`Hold token ${token} not found or expired`);
    }

    await this.releaseSeats(data.showId, data.seatLabels);
    await this.deleteHoldToken(token);

    for (const seatLabel of data.seatLabels) {
      this.realtime.emitSeatReleased(data.showId, seatLabel);
    }
  }

  /**
   * Atomically try to hold a batch of seats. Returns true on success (all
   * seats held), false if any seat is already held by someone else.
   */
  async tryHoldSeats(
    showId: string,
    seatLabels: string[],
    ttlSeconds: number,
  ): Promise<boolean> {
    if (seatLabels.length === 0) {
      return false;
    }

    const nowMs = Date.now();
    const expiryMs = nowMs + ttlSeconds * 1000;
    const result = await this.redis
      .getClient()
      .eval(
        TRY_HOLD_SEATS_LUA,
        1,
        showHoldsKey(showId),
        String(nowMs),
        String(expiryMs),
        ...seatLabels,
      );

    return result === 1;
  }

  async releaseSeats(showId: string, seatLabels: string[]): Promise<void> {
    if (seatLabels.length === 0) {
      return;
    }
    await this.redis.getClient().zrem(showHoldsKey(showId), ...seatLabels);
  }

  /**
   * Currently-active holds only (score > now). Expired members are naturally
   * invisible — no cleanup job required.
   */
  async getHeldSeats(showId: string): Promise<string[]> {
    const nowMs = Date.now();
    return this.redis
      .getClient()
      .zrangebyscore(showHoldsKey(showId), `(${nowMs}`, '+inf');
  }

  async createHoldToken(
    token: string,
    showId: string,
    seatLabels: string[],
    userId: string,
    ttlSeconds: number,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const key = holdTokenKey(token);
    const client = this.redis.getClient();
    await client.hset(key, {
      showId,
      seatLabels: JSON.stringify(seatLabels),
      userId,
      expiresAt,
    });
    await client.expire(key, ttlSeconds);
  }

  async resolveHoldToken(token: string): Promise<HoldTokenData | null> {
    const data = await this.redis.getClient().hgetall(holdTokenKey(token));
    if (!data || !data.showId || !data.seatLabels || !data.userId) {
      return null;
    }

    let seatLabels: string[];
    try {
      const parsed: unknown = JSON.parse(data.seatLabels);
      if (!Array.isArray(parsed) || !parsed.every((s) => typeof s === 'string')) {
        return null;
      }
      seatLabels = parsed;
    } catch {
      return null;
    }

    return {
      showId: data.showId,
      seatLabels,
      userId: data.userId,
      expiresAt: data.expiresAt ?? '',
    };
  }

  async deleteHoldToken(token: string): Promise<void> {
    await this.redis.getClient().del(holdTokenKey(token));
  }
}
