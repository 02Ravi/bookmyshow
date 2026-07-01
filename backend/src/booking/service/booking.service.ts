import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  BookingStatus,
  ReservationStatus,
  ShowSeatStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { ReservationReconcileService } from '../../reservation/service/reservation-reconcile.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import {
  BookingDetailDto,
  BookingListItemDto,
  bookingDetailInclude,
  toBookingDetailDto,
  toBookingListItemDto,
} from '../dto/booking-response.dto';

export interface CreateBookingResult {
  booking: BookingDetailDto;
  wasCreated: boolean;
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly reservationReconcile: ReservationReconcileService,
    private readonly realtime: RealtimeService,
  ) {}

  async createFromReservation(
    dto: CreateBookingDto,
  ): Promise<CreateBookingResult> {
    const existing = await this.prisma.booking.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: bookingDetailInclude,
    });

    if (existing) {
      return { booking: toBookingDetailDto(existing), wasCreated: false };
    }

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: dto.reservationId },
      include: {
        reservationSeats: {
          include: {
            showSeat: {
              include: { seat: true },
            },
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation ${dto.reservationId} not found`);
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new ConflictException(`Reservation is ${reservation.status}`);
    }

    if (reservation.expiresAt <= new Date()) {
      await this.reservationReconcile.expireReservation(reservation.id);
      throw new GoneException('Reservation has expired');
    }

    const showSeats = reservation.reservationSeats.map((rs) => rs.showSeat);
    const notHeld = showSeats.filter((s) => s.status !== ShowSeatStatus.HELD);
    if (notHeld.length > 0) {
      throw new ConflictException('Seats are not held');
    }

    const showSeatIds = showSeats.map((s) => s.id);

    try {
      const bookingId = await this.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.create({
          data: {
            userId: reservation.userId,
            reservationId: reservation.id,
            status: BookingStatus.CONFIRMED,
            idempotencyKey: dto.idempotencyKey,
            bookingSeats: {
              create: showSeatIds.map((showSeatId) => ({ showSeatId })),
            },
          },
        });

        for (const showSeat of showSeats) {
          const updated = await tx.showSeat.updateMany({
            where: {
              id: showSeat.id,
              status: ShowSeatStatus.HELD,
              version: showSeat.version,
            },
            data: {
              status: ShowSeatStatus.BOOKED,
              version: { increment: 1 },
            },
          });

          if (updated.count !== 1) {
            throw new ConflictException(
              `Seat ${showSeat.id} is no longer held`,
            );
          }
        }

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: ReservationStatus.CONFIRMED },
        });

        return booking.id;
      });

      try {
        await this.redis.deleteHoldKeys(showSeatIds);
      } catch (redisError) {
        this.logger.warn(
          `Failed to delete Redis hold keys after booking: ${String(redisError)}`,
        );
      }

      const created = await this.prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: bookingDetailInclude,
      });

      for (const bs of created.bookingSeats) {
        this.realtime.emitSeatBooked(
          bs.showSeat.show.id,
          bs.showSeat.seatId,
          created.id,
        );
      }

      return { booking: toBookingDetailDto(created), wasCreated: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.booking.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: bookingDetailInclude,
        });
        if (raced) {
          return { booking: toBookingDetailDto(raced), wasCreated: false };
        }
      }
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<BookingListItemDto[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: bookingDetailInclude,
    });

    return bookings.map(toBookingListItemDto);
  }

  async findById(id: string): Promise<BookingDetailDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: bookingDetailInclude,
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    return toBookingDetailDto(booking);
  }

  async cancelBooking(
    bookingId: string,
    userId: string,
  ): Promise<BookingDetailDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: bookingDetailInclude,
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return toBookingDetailDto(booking);
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(`Booking is ${booking.status}`);
    }

    const releases = booking.bookingSeats
      .filter((bs) => bs.showSeat.status === ShowSeatStatus.BOOKED)
      .map((bs) => ({
        showSeatId: bs.showSeat.id,
        showId: bs.showSeat.show.id,
        seatId: bs.showSeat.seatId,
        version: bs.showSeat.version,
      }));

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
      });

      for (const release of releases) {
        const updated = await tx.showSeat.updateMany({
          where: {
            id: release.showSeatId,
            status: ShowSeatStatus.BOOKED,
            version: release.version,
          },
          data: {
            status: ShowSeatStatus.AVAILABLE,
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            `Seat ${release.showSeatId} could not be released`,
          );
        }
      }
    });

    for (const release of releases) {
      this.realtime.emitSeatReleased(release.showId, release.seatId);
    }

    const cancelled = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: bookingDetailInclude,
    });

    return toBookingDetailDto(cancelled);
  }
}
