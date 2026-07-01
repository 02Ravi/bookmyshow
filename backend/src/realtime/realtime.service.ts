import { Injectable } from '@nestjs/common';
import { showRoomKey } from '../common/redis.keys';
import { RealtimeGateway } from './realtime.gateway';
import { REALTIME_EVENTS } from './realtime-events';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitSeatHeld(showId: string, seatId: string, reservationId: string) {
    this.gateway.server
      ?.to(showRoomKey(showId))
      .emit(REALTIME_EVENTS.SEAT_HELD, { showId, seatId, reservationId });
  }

  emitSeatReleased(showId: string, seatId: string) {
    this.gateway.server
      ?.to(showRoomKey(showId))
      .emit(REALTIME_EVENTS.SEAT_RELEASED, { showId, seatId });
  }

  emitSeatBooked(showId: string, seatId: string, bookingId: string) {
    this.gateway.server
      ?.to(showRoomKey(showId))
      .emit(REALTIME_EVENTS.SEAT_BOOKED, { showId, seatId, bookingId });
  }
}
