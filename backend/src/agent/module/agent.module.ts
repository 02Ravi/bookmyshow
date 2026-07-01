import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/module/auth.module';
import { BookingModule } from '../../booking/module/booking.module';
import { CatalogModule } from '../../catalog/module/catalog.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReservationModule } from '../../reservation/module/reservation.module';
import { AgentController } from '../controller/agent.controller';
import { SessionService } from '../session/session.service';

@Module({
  imports: [
    CatalogModule,
    ReservationModule,
    BookingModule,
    AuthModule,
    PrismaModule,
  ],
  controllers: [AgentController],
  providers: [SessionService],
})
export class AgentModule {}
