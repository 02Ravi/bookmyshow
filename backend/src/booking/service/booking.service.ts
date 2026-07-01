import {
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpStatus,
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
import { isReservationExpired } from '../../reservation/service/reservation-expiry.util';
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
  /** HTTP status the controller should respond with — CREATED for a new booking, OK for an idempotent replay. */
  statusCode: HttpStatus;
}

function toCreateBookingResult(
  booking: BookingDetailDto,
  wasCreated: boolean,
): CreateBookingResult {
  return {
    booking,
    wasCreated,
    statusCode: wasCreated ? HttpStatus.CREATED : HttpStatus.OK,
  };
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
      return toCreateBookingResult(toBookingDetailDto(existing), false);
    }

    const { reservation, showSeats, showSeatIds } =
      await this.loadReservationForBooking(dto.reservationId);

    try {
      const bookingId = await this.persistBookingTransaction({
        reservation,
        showSeats,
        showSeatIds,
        idempotencyKey: dto.idempotencyKey,
      });

      const booking = await this.postBookingSideEffects(bookingId, showSeatIds);
      return toCreateBookingResult(booking, true);
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
          return toCreateBookingResult(toBookingDetailDto(raced), false);
        }
      }
      throw error;
    }
  }

  /** Loads and validates the reservation backing a new booking (existence, ACTIVE status, not expired, seats HELD). */
  private async loadReservationForBooking(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
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
      throw new NotFoundException(`Reservation ${reservationId} not found`);
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new ConflictException(`Reservation is ${reservation.status}`);
    }

    if (isReservationExpired(reservation)) {
      await this.reservationReconcile.expireReservation(reservation.id);
      throw new GoneException('Reservation has expired');
    }

    const showSeats = reservation.reservationSeats.map((rs) => rs.showSeat);
    const notHeld = showSeats.filter((s) => s.status !== ShowSeatStatus.HELD);
    if (notHeld.length > 0) {
      throw new ConflictException('Seats are not held');
    }

    return {
      reservation,
      showSeats,
      showSeatIds: showSeats.map((s) => s.id),
    };
  }

  /** Atomically creates the booking, marks seats BOOKED, and marks the reservation CONFIRMED. */
  private async persistBookingTransaction(params: {
    reservation: { id: string; userId: string };
    showSeats: Array<{ id: string; version: number }>;
    showSeatIds: string[];
    idempotencyKey: string;
  }): Promise<string> {
    const { reservation, showSeats, showSeatIds, idempotencyKey } = params;

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          userId: reservation.userId,
          reservationId: reservation.id,
          status: BookingStatus.CONFIRMED,
          idempotencyKey,
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
          throw new ConflictException(`Seat ${showSeat.id} is no longer held`);
        }
      }

      const updatedReservation = await tx.reservation.updateMany({
        where: {
          id: reservation.id,
          status: ReservationStatus.ACTIVE,
        },
        data: { status: ReservationStatus.CONFIRMED },
      });
      if (updatedReservation.count !== 1) {
        throw new ConflictException(
          `Reservation ${reservation.id} is no longer ACTIVE`,
        );
      }

      return booking.id;
    });
  }

  /** Clears Redis holds and emits realtime seat-booked events after a successful booking transaction. */
  private async postBookingSideEffects(
    bookingId: string,
    showSeatIds: string[],
  ): Promise<BookingDetailDto> {
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

    return toBookingDetailDto(created);
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
    const booking = await this.validateCancelEligibility(bookingId, userId);
    if (booking.status === BookingStatus.CANCELLED) {
      return toBookingDetailDto(booking);
    }

    const releases = booking.bookingSeats
      .filter((bs) => bs.showSeat.status === ShowSeatStatus.BOOKED)
      .map((bs) => ({
        showSeatId: bs.showSeat.id,
        showId: bs.showSeat.show.id,
        seatId: bs.showSeat.seatId,
        version: bs.showSeat.version,
      }));

    await this.releaseBookedSeatsInTransaction(bookingId, releases);

    for (const release of releases) {
      this.realtime.emitSeatReleased(release.showId, release.seatId);
    }

    const cancelled = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: bookingDetailInclude,
    });

    return toBookingDetailDto(cancelled);
  }

  /** Loads the booking and validates ownership + a cancellable status (CONFIRMED, or already CANCELLED as a no-op). */
  private async validateCancelEligibility(bookingId: string, userId: string) {
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

    if (
      booking.status !== BookingStatus.CANCELLED &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new ConflictException(`Booking is ${booking.status}`);
    }

    return booking;
  }

  /** Marks the booking CANCELLED and releases its BOOKED seats back to AVAILABLE, atomically. */
  private async releaseBookedSeatsInTransaction(
    bookingId: string,
    releases: Array<{ showSeatId: string; version: number }>,
  ): Promise<void> {
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
  }
}
