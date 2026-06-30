import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RealtimeModule } from './realtime/realtime.module';
import { CatalogModule } from './catalog/module/catalog.module';
import { ReservationModule } from './reservation/module/reservation.module';
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
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    RealtimeModule,
    CatalogModule,
    ReservationModule,
    BookingModule,
    AuthModule,
  ],
})
export class AppModule {}
