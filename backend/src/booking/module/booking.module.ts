import { Module } from '@nestjs/common';
import { ReservationModule } from '../../reservation/module/reservation.module';
import { BookingController } from '../controller/booking.controller';
import { BookingService } from '../service/booking.service';

@Module({
  imports: [ReservationModule],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
