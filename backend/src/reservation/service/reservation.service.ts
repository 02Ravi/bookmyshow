import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ReservationStatus,
  ShowSeatStatus,
} from '../../generated/prisma/client';
import { HOLD_TTL_SECONDS } from '../../common/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { CreateReservationDto } from '../dto/create-reservation.dto';
import { ReservationResponseDto } from '../dto/reservation-response.dto';
import { ReservationReconcileService } from './reservation-reconcile.service';

@Injectable()
export class ReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeService,
    private readonly reservationReconcile: ReservationReconcileService,
  ) {}

  async create(dto: CreateReservationDto): Promise<ReservationResponseDto> {
    const showSeats = await this.prisma.showSeat.findMany({
      where: { id: { in: dto.showSeatIds } },
      include: { seat: true },
    });

    if (showSeats.length !== dto.showSeatIds.length) {
      throw new NotFoundException('One or more seats not found');
    }

    const wrongShow = showSeats.filter((s) => s.showId !== dto.showId);
    if (wrongShow.length > 0) {
      throw new ConflictException('Seats do not belong to this show');
    }

    const unavailable = showSeats.filter(
      (s) => s.status !== ShowSeatStatus.AVAILABLE,
    );
    if (unavailable.length > 0) {
      throw new ConflictException('One or more seats are not available');
    }

    const holdTtlSeconds = dto.holdDurationSeconds ?? HOLD_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + holdTtlSeconds * 1000);

    const reservation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          userId: dto.userId,
          status: ReservationStatus.ACTIVE,
          expiresAt,
          reservationSeats: {
            create: dto.showSeatIds.map((showSeatId) => ({ showSeatId })),
          },
        },
      });

      for (const showSeat of showSeats) {
        const updated = await tx.showSeat.updateMany({
          where: {
            id: showSeat.id,
            status: ShowSeatStatus.AVAILABLE,
            version: showSeat.version,
          },
          data: {
            status: ShowSeatStatus.HELD,
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException(
            `Seat ${showSeat.id} is no longer available`,
          );
        }
      }

      return created;
    });

    await this.redis.setHoldKeys(
      dto.showSeatIds,
      reservation.id,
      holdTtlSeconds,
    );

    for (const showSeat of showSeats) {
      this.realtime.emitSeatHeld(dto.showId, showSeat.seatId, reservation.id);
    }

    return {
      id: reservation.id,
      userId: reservation.userId,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      showId: dto.showId,
      showSeatIds: dto.showSeatIds,
    };
  }

  async cancel(reservationId: string): Promise<void> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        reservationSeats: {
          include: { showSeat: { include: { seat: true } } },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation ${reservationId} not found`);
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new ConflictException(`Reservation is ${reservation.status}`);
    }

    const transitioned =
      await this.reservationReconcile.expireReservation(reservationId);
    if (!transitioned) {
      throw new ConflictException(
        `Reservation ${reservationId} could not be cancelled (already transitioned)`,
      );
    }
  }
}
