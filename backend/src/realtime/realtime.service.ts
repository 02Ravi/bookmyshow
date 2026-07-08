import { Injectable } from '@nestjs/common';
import { showRoomKey } from '../common/redis.keys';
import { RealtimeGateway } from './realtime.gateway';
import { REALTIME_EVENTS } from './realtime-events';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitSeatHeld(showId: string, seatLabel: string, holdToken: string) {
    this.gateway.server
      ?.to(showRoomKey(showId))
      .emit(REALTIME_EVENTS.SEAT_HELD, { showId, seatLabel, holdToken });
  }

  emitSeatReleased(showId: string, seatLabel: string) {
    this.gateway.server
      ?.to(showRoomKey(showId))
      .emit(REALTIME_EVENTS.SEAT_RELEASED, { showId, seatLabel });
  }

  emitSeatBooked(showId: string, seatLabel: string, bookingId: string) {
    this.gateway.server
      ?.to(showRoomKey(showId))
      .emit(REALTIME_EVENTS.SEAT_BOOKED, { showId, seatLabel, bookingId });
  }
}
