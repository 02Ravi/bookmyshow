export const REALTIME_EVENTS = {
  SEAT_HELD: 'seat-held',
  SEAT_RELEASED: 'seat-released',
  SEAT_BOOKED: 'seat-booked',
} as const;

export interface SeatHeldPayload {
  showId: string;
  seatLabel: string;
  holdToken: string;
}

export interface SeatReleasedPayload {
  showId: string;
  seatLabel: string;
}

export interface SeatBookedPayload {
  showId: string;
  seatLabel: string;
  bookingId: string;
}
