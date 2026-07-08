import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AgentModule } from './agent/module/agent.module';
import { CatalogModule } from './catalog/module/catalog.module';
import { HoldModule } from './hold/module/hold.module';
import { BookingModule } from './booking/module/booking.module';
import { AuthModule } from './auth/module/auth.module';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig],
    }),
    PrismaModule,
    RedisModule,
    RealtimeModule,
    AgentModule,
    CatalogModule,
    HoldModule,
    BookingModule,
    AuthModule,
  ],
})
export class AppModule {}
