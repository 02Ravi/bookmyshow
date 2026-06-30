import { Injectable } from '@nestjs/common';
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

  async expireReservation(reservationId: string): Promise<void> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        reservationSeats: {
          include: { showSeat: true },
        },
      },
    });

    if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
      return;
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
      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.EXPIRED },
      });

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
  }
}
