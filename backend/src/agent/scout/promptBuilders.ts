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
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
  price: number | string;
}

export interface BookingTicketSource {
  bookingId: string;
  movieTitle: string;
  showTime: string | Date;
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
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    .map((seat) => `- ${seat.row}${seat.number} (${seat.type}) — ₹${seat.price}`)
    .join('\n');

  return {
    toolName: 'uiMarkdown',
    input: {
      markdown: `## Booking Confirmed

**${booking.movieTitle}**

Showtime: ${showTime}

**Seats**
${seatLines}

**Total: ₹${booking.totalPrice}**`,
    },
  };
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
