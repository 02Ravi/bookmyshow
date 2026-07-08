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
import { BookingStatus } from '../../generated/prisma/client';
import { computeSeatsForScreen } from '../../catalog/util/computeSeatsForScreen';
import { HoldService } from '../../hold/service/hold.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
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
    private readonly holdService: HoldService,
    private readonly realtime: RealtimeService,
  ) {}

  async createFromHold(dto: CreateBookingDto): Promise<CreateBookingResult> {
    const existing = await this.prisma.booking.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: bookingDetailInclude,
    });

    if (existing) {
      return toCreateBookingResult(toBookingDetailDto(existing), false);
    }

    const hold = await this.holdService.resolveHoldToken(dto.holdToken);
    if (!hold) {
      throw new GoneException('Hold token not found or expired');
    }

    const currentlyHeld = new Set(
      await this.holdService.getHeldSeats(hold.showId),
    );
    const missing = hold.seatLabels.filter((label) => !currentlyHeld.has(label));
    if (missing.length > 0) {
      throw new GoneException(
        `Hold expired for seat(s): ${missing.join(', ')}`,
      );
    }

    const show = await this.prisma.show.findUnique({
      where: { id: hold.showId },
      include: { screen: true },
    });
    if (!show) {
      throw new NotFoundException(`Show ${hold.showId} not found`);
    }

    const allSeats = computeSeatsForScreen(
      show.screen.layoutConfig,
      Number(show.basePrice),
    );
    const seatByLabel = new Map(allSeats.map((s) => [s.seatLabel, s]));
    const seatInfos = hold.seatLabels.map((label) => {
      const info = seatByLabel.get(label);
      if (!info) {
        throw new NotFoundException(`Unknown seat label ${label}`);
      }
      return info;
    });

    const totalPrice = seatInfos.reduce((sum, s) => sum + s.price, 0);

    try {
      const bookingId = await this.prisma.$transaction(async (tx) => {
        const booking = await tx.booking.create({
          data: {
            userId: hold.userId,
            status: BookingStatus.CONFIRMED,
            totalPrice,
            idempotencyKey: dto.idempotencyKey,
            bookedSeats: {
              create: seatInfos.map((seat) => ({
                showId: hold.showId,
                seatLabel: seat.seatLabel,
                type: seat.type,
                price: seat.price,
              })),
            },
          },
        });
        return booking.id;
      });

      const booking = await this.postBookingSideEffects(
        bookingId,
        hold.showId,
        hold.seatLabels,
        dto.holdToken,
      );
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
        throw new ConflictException(
          'One or more seats were just booked by another request',
        );
      }
      throw error;
    }
  }

  private async postBookingSideEffects(
    bookingId: string,
    showId: string,
    seatLabels: string[],
    holdToken: string,
  ): Promise<BookingDetailDto> {
    try {
      await this.holdService.releaseSeats(showId, seatLabels);
      await this.holdService.deleteHoldToken(holdToken);
    } catch (redisError) {
      this.logger.warn(
        `Failed to clear Redis hold after booking: ${String(redisError)}`,
      );
    }

    const created = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: bookingDetailInclude,
    });

    for (const seatLabel of seatLabels) {
      this.realtime.emitSeatBooked(showId, seatLabel, created.id);
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

    const seatLabels = booking.bookedSeats.map((bs) => bs.seatLabel);
    const showId = booking.bookedSeats[0]?.show.id;
    // Build response from pre-delete snapshot — BookedSeat rows are removed on cancel.
    const cancelledDto = toBookingDetailDto({
      ...booking,
      status: BookingStatus.CANCELLED,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
      });
      await tx.bookedSeat.deleteMany({
        where: { bookingId },
      });
    });

    if (showId) {
      for (const seatLabel of seatLabels) {
        this.realtime.emitSeatReleased(showId, seatLabel);
      }
    }

    return cancelledDto;
  }

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
}
