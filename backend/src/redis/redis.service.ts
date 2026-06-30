import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { seatHoldKey } from '../common/redis-hold.keys';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async setHoldKeys(
    showSeatIds: string[],
    reservationId: string,
    ttlSeconds: number,
  ): Promise<void> {
    if (showSeatIds.length === 0) {
      return;
    }
    const pipeline = this.client.pipeline();
    for (const showSeatId of showSeatIds) {
      pipeline.set(seatHoldKey(showSeatId), reservationId, 'EX', ttlSeconds);
    }
    await pipeline.exec();
  }

  async deleteHoldKeys(showSeatIds: string[]): Promise<void> {
    if (showSeatIds.length === 0) {
      return;
    }
    const pipeline = this.client.pipeline();
    for (const showSeatId of showSeatIds) {
      pipeline.del(seatHoldKey(showSeatId));
    }
    await pipeline.exec();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
