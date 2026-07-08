import { api } from '@/lib/api';
import type { SeatStatus } from '@/types/status';

export type { SeatStatus };
export type SeatType = 'REGULAR' | 'PREMIUM' | 'RECLINER';

export interface ShowSeat {
  seatLabel: string;
  row: string;
  number: number;
  type: SeatType | string;
  status: SeatStatus;
  price: string;
}

export interface HoldResponse {
  token: string;
  userId: string;
  showId: string;
  seatLabels: string[];
  expiresAt: string;
}

export interface Booking {
  id: string;
  status: string;
  idempotencyKey: string;
  totalPrice: string;
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
  seatLabel: string;
  row: string;
  number: number;
  type: SeatType | string;
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

export async function createHold(payload: {
  userId: string;
  showId: string;
  seatLabels: string[];
  holdDurationSeconds?: number;
}): Promise<HoldResponse> {
  const { data } = await api.post<HoldResponse>('/holds', payload);
  return data;
}

export async function releaseHoldSafe(token: string): Promise<void> {
  try {
    await api.delete(`/holds/${token}`);
  } catch {
    // No-op if already cancelled, confirmed, or not found
  }
}

export async function createBooking(payload: {
  holdToken: string;
  idempotencyKey: string;
}): Promise<Booking> {
  const { data } = await api.post<Booking>('/bookings', payload);
  return data;
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
