import { api } from '@/lib/api';

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';
export type SeatType = 'REGULAR' | 'PREMIUM' | 'RECLINER';

export interface ShowSeat {
  showSeatId: string;
  seatId: string;
  row: string;
  number: number;
  type: SeatType;
  status: SeatStatus;
  price: string;
}

export interface Reservation {
  id: string;
  userId: string;
  status: string;
  expiresAt: string;
  showId: string;
  showSeatIds: string[];
}

export interface Booking {
  id: string;
  status: string;
  idempotencyKey: string;
  reservationId: string;
  userId: string;
  createdAt: string;
}

export interface BookingMovieSummary {
  id: string;
  title: string;
  posterUrl: string;
}

export interface BookingTheatreSummary {
  id: string;
  name: string;
  city: string;
}

export interface BookingShowSummary {
  id: string;
  startTime: string;
  endTime: string;
  movie: BookingMovieSummary;
  theatre: BookingTheatreSummary;
}

export interface BookingSeat {
  showSeatId: string;
  row: string;
  number: number;
  type: SeatType;
  price: string;
}

export interface BookingDetail extends Booking {
  show: BookingShowSummary;
  seats: BookingSeat[];
}

export interface BookingListItem extends Booking {
  seatCount: number;
  show: BookingShowSummary;
}

export async function fetchShowSeats(showId: string): Promise<ShowSeat[]> {
  const { data } = await api.get<ShowSeat[]>(`/shows/${showId}/seats`);
  return data;
}

export async function createReservation(payload: {
  userId: string;
  showId: string;
  showSeatIds: string[];
  holdDurationSeconds?: number;
}): Promise<Reservation> {
  const { data } = await api.post<Reservation>('/reservations', payload);
  return data;
}

export async function cancelReservationSafe(reservationId: string): Promise<void> {
  try {
    await api.delete(`/reservations/${reservationId}`);
  } catch {
    // No-op if already cancelled, confirmed, or not found
  }
}

export async function createBooking(payload: {
  reservationId: string;
  idempotencyKey: string;
}): Promise<Booking> {
  const { data } = await api.post<Booking>('/bookings', payload);
  return data;
}

export async function cancelReservation(reservationId: string): Promise<void> {
  await cancelReservationSafe(reservationId);
}

export async function fetchBookingById(id: string): Promise<BookingDetail> {
  const { data } = await api.get<BookingDetail>(`/bookings/${id}`);
  return data;
}

export async function fetchBookingsByUser(
  userId: string,
): Promise<BookingListItem[]> {
  const { data } = await api.get<BookingListItem[]>('/bookings', {
    params: { userId },
  });
  return data;
}
