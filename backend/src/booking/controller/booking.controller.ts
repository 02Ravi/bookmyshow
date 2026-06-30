import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { ListBookingsQueryDto } from '../dto/list-bookings-query.dto';
import { BookingService } from '../service/booking.service';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  async create(
    @Body() dto: CreateBookingDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.bookingService.createFromReservation(dto);
    res.status(
      result.wasCreated ? HttpStatus.CREATED : HttpStatus.OK,
    );
    return result.booking;
  }

  @Get()
  list(@Query() query: ListBookingsQueryDto) {
    return this.bookingService.findByUserId(query.userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookingService.findById(id);
  }
}
