import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { RedisModule } from '../../redis/redis.module';
import { HoldController } from '../controller/hold.controller';
import { HoldService } from '../service/hold.service';

@Module({
  imports: [RedisModule, PrismaModule, RealtimeModule],
  controllers: [HoldController],
  providers: [HoldService],
  exports: [HoldService],
})
export class HoldModule {}
