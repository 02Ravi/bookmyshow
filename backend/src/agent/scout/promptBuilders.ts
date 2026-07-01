import { ShowSeatStatus } from '../../generated/prisma/client';
import { UUID_PATTERN } from '../../common/uuid';

export interface UiPromptToolCall {
  toolName: 'uiPrompt';
  input: Record<string, unknown>;
}

export interface MovieChoiceSource {
  id: string;
  title: string;
  genre: string;
}

export interface ShowChoiceSource {
  id: string;
  startTime: string | Date;
  theatreName: string;
  screenName?: string;
  availableSeats: number;
}

export interface SeatChoiceSource {
  showSeatId: string;
  row: string;
  number: number;
  type: string;
  status: ShowSeatStatus;
  price: number | string;
}

export interface BookingTicketSource {
  bookingId: string;
  movieTitle: string;
  showTime: string | Date;
  theatreName?: string;
  theatreCity?: string;
  seats: Array<{
    row: string;
    number: number;
    type: string;
    price: number | string;
  }>;
  totalPrice: string;
}

export interface UiMarkdownToolCall {
  toolName: 'uiMarkdown';
  input: { markdown: string };
}

function formatDisplayDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatShowTime(startTime: string | Date): string {
  const date = typeof startTime === 'string' ? new Date(startTime) : startTime;
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

export function buildMoviePickerInput(
  movies: MovieChoiceSource[],
): UiPromptToolCall {
  return {
    toolName: 'uiPrompt',
    input: {
      type: 'choice_group',
      message: 'Please select a movie:',
      mode: 'single',
      presentation: 'dropdown',
      choices: movies.map((movie) => ({
        label: `${movie.title} (${movie.genre})`,
        value: movie.id,
      })),
    },
  };
}

export function buildDateChoiceInput(
  dates: string[],
  message = 'Pick a date:',
): UiPromptToolCall {
  return {
    toolName: 'uiPrompt',
    input: {
      type: 'choice_group',
      message,
      mode: 'single',
      presentation: 'chips',
      choices: dates.map((date) => ({
        label: formatDisplayDate(date),
        value: date,
      })),
    },
  };
}

export function isDateBrowseMessage(message: string): boolean {
  return /\b(other date|another date|different date|available dates?|what dates?|change date)\b/i.test(
    message.trim(),
  );
}

export function buildShowPickerInput(
  shows: ShowChoiceSource[],
): UiPromptToolCall {
  return {
    toolName: 'uiPrompt',
    input: {
      type: 'choice_group',
      message: 'Please select a showtime:',
      mode: 'single',
      presentation: 'dropdown',
      choices: shows.map((show) => ({
        label: `${show.theatreName} · ${formatShowTime(show.startTime)} · ${show.availableSeats} seats`,
        value: show.id,
        description: show.screenName,
      })),
    },
  };
}

export function buildSeatPickerInput(
  seats: SeatChoiceSource[],
  message = 'Select your seats:',
): UiPromptToolCall {
  return {
    toolName: 'uiPrompt',
    input: {
      type: 'seat_picker',
      message,
      seats: seats.map((seat) => ({
        showSeatId: seat.showSeatId,
        row: seat.row,
        number: seat.number,
        type: seat.type,
        status: seat.status,
        price: typeof seat.price === 'number' ? seat.price : Number(seat.price),
      })),
      maxSelections: 0,
    },
  };
}

export const DATE_MESSAGE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export { UUID_PATTERN };

export function isSeatIdsMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed.startsWith('[')) return false;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return false;

    return parsed.every(
      (id) => typeof id === 'string' && UUID_PATTERN.test(id),
    );
  } catch {
    return false;
  }
}

export const PROFILE_MESSAGE_PREFIX = 'PROFILE:';

export interface ProfilePayload {
  name: string;
  email: string;
  phone: string;
}

export function isProfileMessage(message: string): boolean {
  return message.trim().startsWith(PROFILE_MESSAGE_PREFIX);
}

export function parseProfileMessage(message: string): ProfilePayload | null {
  if (!isProfileMessage(message)) return null;

  try {
    const raw = message.trim().slice(PROFILE_MESSAGE_PREFIX.length);
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const record = parsed as Record<string, unknown>;
    if (
      typeof record.name !== 'string' ||
      typeof record.email !== 'string' ||
      typeof record.phone !== 'string'
    ) {
      return null;
    }

    const name = record.name.trim();
    const email = record.email.trim();
    const phone = record.phone.trim();

    if (!name || !email || !phone) return null;

    return { name, email, phone };
  } catch {
    return null;
  }
}

export function parsePendingShowSeatIds(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is string => typeof id === 'string' && UUID_PATTERN.test(id),
    );
  } catch {
    return [];
  }
}

export function buildProfileFormInput(
  message = 'Enter your details to hold seats:',
): UiPromptToolCall {
  return {
    toolName: 'uiPrompt',
    input: {
      type: 'profile_form',
      message,
    },
  };
}

export function hasSessionIdentity(session: {
  userId: string | null;
  email: string | null;
  name: string | null;
}): boolean {
  return Boolean(session.userId && session.email && session.name);
}

export function buildHoldConfirmInput(params: {
  seatsHeld: number;
  expiresAt?: string | Date;
}): UiPromptToolCall {
  const expiryNote =
    params.expiresAt != null
      ? ` Hold expires at ${formatShowTime(params.expiresAt)}.`
      : '';
  const seatLabel = params.seatsHeld === 1 ? 'seat is' : 'seats are';

  return {
    toolName: 'uiPrompt',
    input: {
      type: 'confirm',
      message: `Your ${params.seatsHeld} ${seatLabel} held.${expiryNote} Confirm booking to complete?`,
      choices: [
        { label: 'Confirm', value: 'confirm' },
        { label: 'Cancel', value: 'cancel' },
      ],
    },
  };
}

export function buildTicketMarkdownInput(
  booking: BookingTicketSource,
): UiMarkdownToolCall {
  const showTime = formatShowTime(booking.showTime);
  const seatLines = booking.seats
    .map(
      (seat) => `- ${seat.row}${seat.number} (${seat.type}) — ₹${seat.price}`,
    )
    .join('\n');
  const theatreLine =
    booking.theatreName && booking.theatreCity
      ? `\nVenue: ${booking.theatreName}, ${booking.theatreCity}`
      : '';

  return {
    toolName: 'uiMarkdown',
    input: {
      markdown: `## Your Ticket

**${booking.movieTitle}**

Showtime: ${showTime}${theatreLine}

**Seats**
${seatLines}

**Total: ₹${booking.totalPrice}**

Booking ID: \`${booking.bookingId}\``,
    },
  };
}

export interface BookingDetailForTicket {
  id: string;
  status: string;
  show: {
    startTime: Date | string;
    movie: { title: string };
    theatre: { name: string; city: string };
  };
  seats: Array<{
    row: string;
    number: number;
    type: string;
    price: string;
  }>;
}

export function bookingDetailToTicketSource(
  detail: BookingDetailForTicket,
): BookingTicketSource {
  const totalPrice = detail.seats
    .reduce((sum, seat) => sum + Number(seat.price), 0)
    .toFixed(2);

  return {
    bookingId: detail.id,
    movieTitle: detail.show.movie.title,
    showTime: detail.show.startTime,
    theatreName: detail.show.theatre.name,
    theatreCity: detail.show.theatre.city,
    seats: detail.seats.map((seat) => ({
      row: seat.row,
      number: seat.number,
      type: seat.type,
      price: seat.price,
    })),
    totalPrice,
  };
}

export function isViewBookingsMessage(message: string): boolean {
  if (isCancelBookingMessage(message)) return false;

  const normalized = message.trim().toLowerCase();
  if (
    /\b(my|show|view|see|list|upcoming|confirmed|detailed?)\b.*\b(bookings?|tickets?)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /\b(bookings?|tickets?)\b.*\b(details?|detail|show|view|list)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/\bwhat\b.*\b(booked|booking)\b/.test(normalized)) return true;
  if (/\b(how many|any)\b.*\b(tickets?|bookings?)\b/.test(normalized)) {
    return true;
  }
  if (normalized.includes('ticket booked')) return true;

  return false;
}

export interface BookingCancelChoiceSource {
  id: string;
  movieTitle: string;
  startTime: string | Date;
  status: string;
}

export function isCancelBookingMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (normalized.includes('cancel one of')) return true;
  if (/cancel\s+(one|my|a|the)\s+(booking|ticket|them)/.test(normalized)) {
    return true;
  }
  if (/cancel.*(booking|ticket)/.test(normalized)) return true;
  return false;
}

export function buildBookingCancelPickerInput(
  bookings: BookingCancelChoiceSource[],
): UiPromptToolCall {
  return {
    toolName: 'uiPrompt',
    input: {
      type: 'choice_group',
      message: 'Which booking would you like to cancel?',
      mode: 'single',
      presentation: 'dropdown',
      choices: bookings.map((booking) => ({
        label: `${booking.movieTitle} · ${formatShowTime(booking.startTime)}`,
        value: booking.id,
        description: booking.status,
      })),
    },
  };
}

export function buildCancelConfirmInput(params: {
  movieTitle: string;
  showTime: string | Date;
}): UiPromptToolCall {
  return {
    toolName: 'uiPrompt',
    input: {
      type: 'confirm',
      message: `Cancel your ticket for ${params.movieTitle} (${formatShowTime(params.showTime)})?`,
      choices: [
        { label: 'Yes, cancel', value: 'confirm' },
        { label: 'Keep booking', value: 'cancel' },
      ],
    },
  };
}

export function buildCancelSuccessMarkdownInput(params: {
  movieTitle: string;
  showTime: string | Date;
}): UiMarkdownToolCall {
  return {
    toolName: 'uiMarkdown',
    input: {
      markdown: `## Booking Cancelled

Your ticket for **${params.movieTitle}** (${formatShowTime(params.showTime)}) has been cancelled. The seats are available again.`,
    },
  };
}
