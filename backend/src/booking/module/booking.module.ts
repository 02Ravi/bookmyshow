import { Module } from '@nestjs/common';
import { HoldModule } from '../../hold/module/hold.module';
import { BookingController } from '../controller/booking.controller';
import { BookingService } from '../service/booking.service';

@Module({
  imports: [HoldModule],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
