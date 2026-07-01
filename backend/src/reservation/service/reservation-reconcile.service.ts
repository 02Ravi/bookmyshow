import { ConflictException, Injectable } from '@nestjs/common';
import {
  ReservationStatus,
  ShowSeatStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RealtimeService } from '../../realtime/realtime.service';

@Injectable()
export class ReservationReconcileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Transitions an ACTIVE reservation to EXPIRED and releases its held seats. Returns whether a transition actually happened. */
  async expireReservation(reservationId: string): Promise<boolean> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        reservationSeats: {
          include: { showSeat: true },
        },
      },
    });

    if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
      return false;
    }

    const heldShowSeatIds = reservation.reservationSeats
      .filter((rs) => rs.showSeat.status === ShowSeatStatus.HELD)
      .map((rs) => rs.showSeatId);

    const releases = reservation.reservationSeats
      .filter((rs) => rs.showSeat.status === ShowSeatStatus.HELD)
      .map((rs) => ({
        showId: rs.showSeat.showId,
        seatId: rs.showSeat.seatId,
      }));

    await this.prisma.$transaction(async (tx) => {
      const updatedReservation = await tx.reservation.updateMany({
        where: { id: reservationId, status: ReservationStatus.ACTIVE },
        data: { status: ReservationStatus.EXPIRED },
      });
      if (updatedReservation.count !== 1) {
        throw new ConflictException(
          `Reservation ${reservationId} is no longer ACTIVE`,
        );
      }

      for (const rs of reservation.reservationSeats) {
        if (rs.showSeat.status !== ShowSeatStatus.HELD) {
          continue;
        }
        await tx.showSeat.updateMany({
          where: {
            id: rs.showSeatId,
            status: ShowSeatStatus.HELD,
            version: rs.showSeat.version,
          },
          data: {
            status: ShowSeatStatus.AVAILABLE,
            version: { increment: 1 },
          },
        });
      }
    });

    await this.redis.deleteHoldKeys(heldShowSeatIds);

    for (const { showId, seatId } of releases) {
      this.realtime.emitSeatReleased(showId, seatId);
    }

    return true;
  }
}
