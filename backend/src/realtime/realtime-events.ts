export const REALTIME_EVENTS = {
  SEAT_HELD: 'seat-held',
  SEAT_RELEASED: 'seat-released',
  SEAT_BOOKED: 'seat-booked',
} as const;

export interface SeatHeldPayload {
  showId: string;
  seatId: string;
  reservationId: string;
}

export interface SeatReleasedPayload {
  showId: string;
  seatId: string;
}

export interface SeatBookedPayload {
  showId: string;
  seatId: string;
  bookingId: string;
}
