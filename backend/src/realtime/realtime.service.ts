import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitSeatHeld(showId: string, seatId: string, reservationId: string) {
    this.gateway.server
      ?.to(`show:${showId}`)
      .emit('seat-held', { showId, seatId, reservationId });
  }

  emitSeatReleased(showId: string, seatId: string) {
    this.gateway.server
      ?.to(`show:${showId}`)
      .emit('seat-released', { showId, seatId });
  }

  emitSeatBooked(showId: string, seatId: string, bookingId: string) {
    this.gateway.server
      ?.to(`show:${showId}`)
      .emit('seat-booked', { showId, seatId, bookingId });
  }
}
