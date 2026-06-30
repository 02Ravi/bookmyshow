import { Module } from '@nestjs/common';
import { ReservationController } from '../controller/reservation.controller';
import { ReservationReconcileCron } from '../service/reservation-reconcile.cron';
import { ReservationReconcileService } from '../service/reservation-reconcile.service';
import { ReservationService } from '../service/reservation.service';

@Module({
  controllers: [ReservationController],
  providers: [
    ReservationService,
    ReservationReconcileService,
    ReservationReconcileCron,
  ],
  exports: [ReservationReconcileService],
})
export class ReservationModule {}
