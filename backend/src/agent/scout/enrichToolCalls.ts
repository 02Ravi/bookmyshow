import { ConflictException } from '@nestjs/common';
import { BookingService } from '../../booking/service/booking.service';
import { CatalogService } from '../../catalog/service/catalog.service';
import { ReservationService } from '../../reservation/service/reservation.service';
import { AgentSession } from '../session/session.service';
import {
  DATE_MESSAGE_PATTERN,
  UUID_PATTERN,
  buildBookingCancelPickerInput,
  buildCancelConfirmInput,
  buildCancelSuccessMarkdownInput,
  buildDateChoiceInput,
  buildHoldConfirmInput,
  buildMoviePickerInput,
  buildSeatPickerInput,
  buildShowPickerInput,
  buildTicketMarkdownInput,
  isCancelBookingMessage,
  isDateBrowseMessage,
  isSeatIdsMessage,
  MovieChoiceSource,
  ShowChoiceSource,
  SeatChoiceSource,
  UiMarkdownToolCall,
  UiPromptToolCall,
} from './promptBuilders';

interface StepToolCall {
  toolName: string;
  input?: unknown;
  args?: unknown;
}

interface StepToolResult {
  toolName: string;
  result?: unknown;
  output?: unknown;
}

interface AgentStep {
  toolCalls?: StepToolCall[];
  toolResults?: StepToolResult[];
}

interface LoopResult {
  text: string;
  toolCalls: unknown[];
  steps: unknown;
}

interface EnrichParams {
  loopResult: LoopResult;
  session: AgentSession;
  lastUserMessage: string;
  catalog: CatalogService;
  reservation: ReservationService;
  booking: BookingService;
  sessionId: string;
}

interface EnrichResult {
  toolCalls: unknown[];
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getToolInput(toolCall: StepToolCall): unknown {
  return toolCall.input ?? toolCall.args;
}

function getToolResult(toolResult: StepToolResult): unknown {
  return toolResult.result ?? toolResult.output;
}

function normalizeToolName(toolCall: unknown): string | null {
  if (!isRecord(toolCall)) return null;
  if (typeof toolCall.toolName === 'string') return toolCall.toolName;
  if (typeof toolCall.name === 'string') return toolCall.name;
  return null;
}

function hasUiPromptOfType(
  type: string,
  toolCalls: unknown[],
  executions: Array<{ toolName: string; input: unknown; result: unknown }>,
): boolean {
  for (const toolCall of toolCalls) {
    if (!isRecord(toolCall)) continue;
    // Skip invalid tool calls — they get filtered before the response is sent,
    // so they should not be counted as "present" for enrichment decisions.
    if (toolCall['invalid'] === true) continue;
    if (normalizeToolName(toolCall) !== 'uiPrompt') continue;
    const input = toolCall.input ?? toolCall.args;
    if (isRecord(input) && input.type === type) return true;
  }

  for (const execution of executions) {
    if (execution.toolName !== 'uiPrompt') continue;
    // Skip executions that never ran (invalid or unexecuted tool calls have null result).
    if (execution.result === null) continue;
    if (isRecord(execution.input) && execution.input.type === type) {
      return true;
    }
  }

  return false;
}

function findToolCallInput(toolCalls: unknown[], toolName: string): unknown {
  for (const toolCall of toolCalls) {
    if (!isRecord(toolCall)) continue;
    if (normalizeToolName(toolCall) !== toolName) continue;
    return toolCall.input ?? toolCall.args;
  }

  return null;
}

function isMovieBrowseMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (normalized === '?' || normalized.length === 0) return true;

  return /\b(book|browse|have|movie|movies|show|ticket|watch)\b/.test(
    normalized,
  );
}

function isDateChoiceGroupInput(input: unknown): boolean {
  if (!isRecord(input) || input.type !== 'choice_group') return false;
  if (!Array.isArray(input.choices) || input.choices.length === 0) return false;

  return input.choices.every((choice) => {
    if (!isRecord(choice) || typeof choice.value !== 'string') return false;
    return DATE_MESSAGE_PATTERN.test(choice.value);
  });
}

function isShowChoiceGroupInput(input: unknown): boolean {
  if (!isRecord(input) || input.type !== 'choice_group') return false;
  if (!Array.isArray(input.choices) || input.choices.length === 0) return false;

  return input.choices.every((choice) => {
    if (!isRecord(choice) || typeof choice.value !== 'string') return false;
    return UUID_PATTERN.test(choice.value);
  });
}

function isInvalidToolCall(toolCall: unknown): boolean {
  return isRecord(toolCall) && toolCall['invalid'] === true;
}

function hasShowChoiceGroupInTurn(
  toolCalls: unknown[],
  executions: Array<{ toolName: string; input: unknown; result: unknown }>,
): boolean {
  for (const toolCall of toolCalls) {
    if (!isRecord(toolCall)) continue;
    if (isInvalidToolCall(toolCall)) continue;
    if (normalizeToolName(toolCall) !== 'uiPrompt') continue;
    const input = toolCall.input ?? toolCall.args;
    if (isShowChoiceGroupInput(input)) return true;
  }

  for (const execution of executions) {
    if (execution.toolName !== 'uiPrompt') continue;
    if (execution.result === null) continue;
    if (isShowChoiceGroupInput(execution.input)) return true;
  }

  return false;
}

function hasBookingCancelPickerInTurn(
  toolCalls: unknown[],
  executions: Array<{ toolName: string; input: unknown; result: unknown }>,
): boolean {
  for (const toolCall of toolCalls) {
    if (!isRecord(toolCall)) continue;
    if (isInvalidToolCall(toolCall)) continue;
    if (normalizeToolName(toolCall) !== 'uiPrompt') continue;
    const input = toolCall.input ?? toolCall.args;
    if (isBookingCancelChoiceGroupInput(input)) return true;
  }

  for (const execution of executions) {
    if (execution.toolName !== 'uiPrompt') continue;
    if (execution.result === null) continue;
    if (isBookingCancelChoiceGroupInput(execution.input)) return true;
  }

  return false;
}

function isBookingCancelChoiceGroupInput(input: unknown): boolean {
  if (!isRecord(input) || input.type !== 'choice_group') return false;
  const message = input.message;
  return (
    typeof message === 'string' &&
    message.toLowerCase().includes('cancel') &&
    message.toLowerCase().includes('booking')
  );
}

function parseCancelBookingResult(result: unknown) {
  if (!isRecord(result)) return null;
  if (typeof result.bookingId !== 'string') return null;
  if (typeof result.movieTitle !== 'string') return null;
  if (!result.showTime) return null;

  return {
    bookingId: result.bookingId,
    movieTitle: result.movieTitle,
    showTime: result.showTime as string | Date,
  };
}

function parseListBookings(result: unknown) {
  if (!Array.isArray(result)) return [];
  return result.flatMap((booking) => {
    if (!isRecord(booking)) return [];
    if (typeof booking.bookingId !== 'string') return [];
    if (typeof booking.movieTitle !== 'string') return [];
    if (!booking.showTime) return [];
    if (booking.status !== 'CONFIRMED') return [];
    return [
      {
        id: booking.bookingId,
        movieTitle: booking.movieTitle,
        startTime: booking.showTime as string | Date,
        status: String(booking.status),
      },
    ];
  });
}

async function tryCompleteCancelBooking(params: {
  session: AgentSession;
  booking: BookingService;
}) {
  const { session, booking } = params;
  if (!session.pendingCancelBookingId || !session.userId) return null;

  const cancelled = await booking.cancelBooking(
    session.pendingCancelBookingId,
    session.userId,
  );
  session.pendingCancelBookingId = null;

  return {
    bookingId: cancelled.id,
    movieTitle: cancelled.show.movie.title,
    showTime: cancelled.show.startTime,
  };
}

function findDateChipPromptInput(
  toolCalls: unknown[],
  executions: Array<{ toolName: string; input: unknown; result: unknown }>,
): Record<string, unknown> | null {
  for (const toolCall of toolCalls) {
    if (!isRecord(toolCall)) continue;
    if (isInvalidToolCall(toolCall)) continue;
    if (normalizeToolName(toolCall) !== 'uiPrompt') continue;
    const input = toolCall.input ?? toolCall.args;
    if (isDateChoiceGroupInput(input) && isRecord(input)) {
      return input;
    }
  }

  for (const execution of executions) {
    if (execution.toolName !== 'uiPrompt') continue;
    if (execution.result === null) continue;
    if (isDateChoiceGroupInput(execution.input) && isRecord(execution.input)) {
      return execution.input;
    }
  }

  return null;
}

function hasDateChipPickerInTurn(
  toolCalls: unknown[],
  executions: Array<{ toolName: string; input: unknown; result: unknown }>,
): boolean {
  return findDateChipPromptInput(toolCalls, executions) !== null;
}

async function buildDatePickerResponse(
  catalog: CatalogService,
  movieId: string,
  message = 'Pick a date:',
): Promise<EnrichResult | null> {
  const dates = await catalog.findShowDatesByMovie(movieId);
  if (dates.length === 0) {
    return null;
  }

  const prompt = buildDateChoiceInput(dates, message);
  return {
    toolCalls: [buildSyntheticUiPromptCall(prompt)],
    text: promptMessage(prompt),
  };
}

function buildSyntheticUiPromptCall(
  prompt: UiPromptToolCall,
): Record<string, unknown> {
  return {
    type: 'tool-call',
    toolName: prompt.toolName,
    input: prompt.input,
  };
}

function buildSyntheticUiMarkdownCall(
  call: UiMarkdownToolCall,
): Record<string, unknown> {
  return {
    type: 'tool-call',
    toolName: call.toolName,
    input: call.input,
  };
}

function collectStepExecutions(steps: unknown): Array<{
  toolName: string;
  input: unknown;
  result: unknown;
}> {
  if (!Array.isArray(steps)) return [];

  const executions: Array<{ toolName: string; input: unknown; result: unknown }> =
    [];

  for (const step of steps as AgentStep[]) {
    const toolCalls = step.toolCalls ?? [];
    const toolResults = step.toolResults ?? [];

    for (let index = 0; index < toolCalls.length; index += 1) {
      const toolCall = toolCalls[index];
      const toolResult = toolResults[index];
      executions.push({
        toolName: toolCall.toolName,
        input: getToolInput(toolCall),
        result: toolResult ? getToolResult(toolResult) : null,
      });
    }
  }

  return executions;
}

function findExecution(
  executions: Array<{ toolName: string; input: unknown; result: unknown }>,
  toolName: string,
) {
  for (let index = executions.length - 1; index >= 0; index -= 1) {
    if (executions[index].toolName === toolName) {
      return executions[index];
    }
  }
  return null;
}

function parseMovies(result: unknown): MovieChoiceSource[] {
  if (!Array.isArray(result)) return [];
  return result.flatMap((movie) => {
    if (!isRecord(movie)) return [];
    if (
      typeof movie.id !== 'string' ||
      typeof movie.title !== 'string' ||
      typeof movie.genre !== 'string'
    ) {
      return [];
    }
    return [
      {
        id: movie.id,
        title: movie.title,
        genre: movie.genre,
      },
    ];
  });
}

function parseShows(result: unknown): ShowChoiceSource[] {
  if (!Array.isArray(result)) return [];
  return result.flatMap((show) => {
    if (!isRecord(show)) return [];
    if (
      typeof show.id !== 'string' ||
      (typeof show.startTime !== 'string' && !(show.startTime instanceof Date)) ||
      typeof show.theatreName !== 'string' ||
      typeof show.availableSeats !== 'number'
    ) {
      return [];
    }
    return [
      {
        id: show.id,
        startTime: show.startTime as string | Date,
        theatreName: show.theatreName,
        screenName:
          typeof show.screenName === 'string' ? show.screenName : undefined,
        availableSeats: show.availableSeats,
      },
    ];
  });
}

function parseSeatMap(result: unknown): SeatChoiceSource[] {
  if (!isRecord(result) || !Array.isArray(result.seats)) return [];
  return parseSeatList(result.seats);
}

function parseSeatList(result: unknown): SeatChoiceSource[] {
  if (!Array.isArray(result)) return [];

  return result.flatMap((seat) => {
    if (!isRecord(seat)) return [];
    if (
      typeof seat.showSeatId !== 'string' ||
      typeof seat.row !== 'string' ||
      typeof seat.number !== 'number' ||
      typeof seat.type !== 'string' ||
      (seat.status !== 'AVAILABLE' &&
        seat.status !== 'HELD' &&
        seat.status !== 'BOOKED')
    ) {
      return [];
    }

    return [
      {
        showSeatId: seat.showSeatId,
        row: seat.row,
        number: seat.number,
        type: seat.type,
        status: seat.status,
        price: seat.price as number | string,
      },
    ];
  });
}

function parseBookingResult(result: unknown) {
  if (!isRecord(result) || typeof result.bookingId !== 'string') return null;
  if (typeof result.movieTitle !== 'string') return null;
  if (!Array.isArray(result.seats)) return null;
  if (typeof result.totalPrice !== 'string') return null;

  const seats = result.seats.flatMap((seat) => {
    if (!isRecord(seat)) return [];
    if (
      typeof seat.row !== 'string' ||
      typeof seat.number !== 'number' ||
      typeof seat.type !== 'string'
    ) {
      return [];
    }

    return [
      {
        row: seat.row,
        number: seat.number,
        type: seat.type,
        price: seat.price as number | string,
      },
    ];
  });

  if (seats.length === 0) return null;

  return {
    bookingId: result.bookingId,
    movieTitle: result.movieTitle,
    showTime: result.showTime as string | Date,
    seats,
    totalPrice: result.totalPrice,
  };
}

function parseSeatIdsFromMessage(message: string): string[] {
  if (!isSeatIdsMessage(message)) return [];

  try {
    const parsed = JSON.parse(message.trim()) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseHoldSeatIds(
  lastUserMessage: string,
  holdSeatsExecution: { input: unknown } | null,
  toolCalls: unknown[],
): string[] {
  const fromMessage = parseSeatIdsFromMessage(lastUserMessage);
  if (fromMessage.length > 0) return fromMessage;

  const holdInput =
    holdSeatsExecution?.input ?? findToolCallInput(toolCalls, 'holdSeats');
  if (!isRecord(holdInput) || !Array.isArray(holdInput.showSeatIds)) {
    return [];
  }

  return holdInput.showSeatIds.filter(
    (id): id is string => typeof id === 'string',
  );
}

async function tryCompleteHold(params: {
  session: AgentSession;
  lastUserMessage: string;
  holdSeatsExecution: { input: unknown; result: unknown } | null;
  toolCalls: unknown[];
  reservation: ReservationService;
}): Promise<{ seatsHeld: number; expiresAt?: Date } | null> {
  const { session, lastUserMessage, holdSeatsExecution, toolCalls, reservation } =
    params;

  if (session.reservationId) {
    const holdResult = holdSeatsExecution?.result;
    if (isRecord(holdResult) && typeof holdResult.seatsHeld === 'number') {
      const expiresAt =
        typeof holdResult.expiresAt === 'string' ||
        holdResult.expiresAt instanceof Date
          ? new Date(holdResult.expiresAt as string | Date)
          : undefined;
      return { seatsHeld: holdResult.seatsHeld, expiresAt };
    }

    const seatIds = parseHoldSeatIds(
      lastUserMessage,
      holdSeatsExecution,
      toolCalls,
    );
    return { seatsHeld: seatIds.length > 0 ? seatIds.length : 1 };
  }

  const seatIds = parseHoldSeatIds(
    lastUserMessage,
    holdSeatsExecution,
    toolCalls,
  );
  const holdInput =
    holdSeatsExecution?.input ?? findToolCallInput(toolCalls, 'holdSeats');
  const showId =
    session.showId ??
    (isRecord(holdInput) && typeof holdInput.showId === 'string'
      ? holdInput.showId
      : null);

  if (!session.userId || !showId || seatIds.length === 0) {
    return null;
  }

  try {
    const holdDurationSeconds =
      process.env.DEMO_FAST_HOLD === 'true' ? 10 : undefined;
    const created = await reservation.create({
      userId: session.userId,
      showId,
      showSeatIds: seatIds,
      holdDurationSeconds,
    });

    session.reservationId = created.id;
    session.showId = showId;

    return {
      seatsHeld: created.showSeatIds.length,
      expiresAt: created.expiresAt,
    };
  } catch (error) {
    if (!(error instanceof ConflictException)) {
      throw error;
    }
    return null;
  }
}

async function tryCompleteBooking(params: {
  session: AgentSession;
  sessionId: string;
  booking: BookingService;
}) {
  const { session, sessionId, booking } = params;
  if (!session.reservationId) return null;

  const result = await booking.createFromReservation({
    reservationId: session.reservationId,
    idempotencyKey: `agent-${sessionId}-${Date.now()}`,
  });

  session.reservationId = null;

  const totalPrice = result.booking.seats.reduce(
    (sum, seat) => sum + Number(seat.price),
    0,
  );

  return {
    bookingId: result.booking.id,
    movieTitle: result.booking.show.movie.title,
    showTime: result.booking.show.startTime,
    seats: result.booking.seats.map((seat) => ({
      row: seat.row,
      number: seat.number,
      type: seat.type,
      price: seat.price,
    })),
    totalPrice: totalPrice.toFixed(2),
  };
}

async function fetchShowsWithAvailability(
  catalog: CatalogService,
  movieId: string,
  date: string,
): Promise<ShowChoiceSource[]> {
  const shows = await catalog.findShows({ movieId, date });

  return Promise.all(
    shows.map(async (show) => {
      const seats = await catalog.findShowSeats(show.id);
      return {
        id: show.id,
        startTime: show.startTime,
        theatreName: show.theatreName,
        screenName: show.screenName,
        availableSeats: seats.filter((seat) => seat.status === 'AVAILABLE').length,
      };
    }),
  );
}

async function fetchMovies(
  catalog: CatalogService,
  queryInput: unknown,
): Promise<MovieChoiceSource[]> {
  const movies = await catalog.findAllMovies();
  const query =
    isRecord(queryInput) && typeof queryInput.query === 'string'
      ? queryInput.query.trim().toLowerCase()
      : '';

  const filtered = query
    ? movies.filter((movie) =>
        [movie.title, movie.genre, movie.language]
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    : movies;

  return filtered.map((movie) => ({
    id: movie.id,
    title: movie.title,
    genre: movie.genre,
  }));
}

function appendSyntheticToolCall(
  toolCalls: unknown[],
  prompt: UiPromptToolCall,
): unknown[] {
  return [
    ...toolCalls,
    {
      type: 'tool-call',
      toolName: prompt.toolName,
      input: prompt.input,
    },
  ];
}

function promptMessage(prompt: UiPromptToolCall): string {
  const message = prompt.input.message;
  return typeof message === 'string' ? message : '';
}

export async function enrichToolCalls(params: EnrichParams): Promise<EnrichResult> {
  const {
    loopResult,
    session,
    lastUserMessage,
    catalog,
    reservation,
    booking,
    sessionId,
  } = params;
  const executions = collectStepExecutions(loopResult.steps);
  let toolCalls = [...loopResult.toolCalls];
  let text = loopResult.text.trim();

  const listMoviesExecution = findExecution(executions, 'listMovies');
  const listShowsExecution = findExecution(executions, 'listShows');
  const getSeatMapExecution = findExecution(executions, 'getSeatMap');
  const holdSeatsExecution = findExecution(executions, 'holdSeats');
  const confirmBookingExecution = findExecution(executions, 'confirmBooking');
  const listBookingsExecution = findExecution(executions, 'listBookings');
  const cancelBookingExecution = findExecution(executions, 'cancelBooking');

  const isDateMessage = DATE_MESSAGE_PATTERN.test(lastUserMessage.trim());
  const isUuidMessage = UUID_PATTERN.test(lastUserMessage.trim());
  const isShowUuidMessage =
    isUuidMessage &&
    !isDateMessage &&
    session.showId === lastUserMessage.trim();
  const isCancelMessage = lastUserMessage.trim().toLowerCase() === 'cancel';
  const isConfirmMessage = lastUserMessage.trim().toLowerCase() === 'confirm';

  // Rule 1: movie dropdown after listMovies
  if (
    (listMoviesExecution?.result || findToolCallInput(toolCalls, 'listMovies')) &&
    !hasUiPromptOfType('choice_group', toolCalls, executions) &&
    !session.movieId
  ) {
    const pendingListMoviesInput = findToolCallInput(toolCalls, 'listMovies');
    const movies = listMoviesExecution?.result
      ? parseMovies(listMoviesExecution.result)
      : await fetchMovies(catalog, pendingListMoviesInput);

    if (movies.length > 0) {
      const prompt = buildMoviePickerInput(movies);
      return {
        toolCalls: appendSyntheticToolCall(toolCalls, prompt),
        text: promptMessage(prompt),
      };
    }
  }

  // Safety net for sessions where the model returns an empty turn instead of
  // calling listMovies after the user asks what is available.
  if (
    !text &&
    toolCalls.length === 0 &&
    !session.movieId &&
    isMovieBrowseMessage(lastUserMessage)
  ) {
    const movies = await fetchMovies(catalog, null);
    if (movies.length > 0) {
      const prompt = buildMoviePickerInput(movies);
      return {
        toolCalls: [buildSyntheticUiPromptCall(prompt)],
        text: promptMessage(prompt),
      };
    }
  }

  // Rule 9: booking cancel picker
  if (
    session.userId &&
    isCancelBookingMessage(lastUserMessage) &&
    !hasBookingCancelPickerInTurn(toolCalls, executions) &&
    !hasUiPromptOfType('confirm', toolCalls, executions)
  ) {
    const listed = listBookingsExecution?.result
      ? parseListBookings(listBookingsExecution.result)
      : [];
    const bookings =
      listed.length > 0
        ? listed
        : (await booking.findByUserId(session.userId))
            .filter((item) => item.status === 'CONFIRMED')
            .map((item) => ({
              id: item.id,
              movieTitle: item.show.movie.title,
              startTime: item.show.startTime,
              status: item.status,
            }));

    if (bookings.length === 0) {
      return {
        toolCalls,
        text: 'You have no confirmed bookings to cancel.',
      };
    }

    const prompt = buildBookingCancelPickerInput(bookings);
    return {
      toolCalls: [buildSyntheticUiPromptCall(prompt)],
      text: promptMessage(prompt),
    };
  }

  // Rule 10: booking UUID -> cancel confirm
  if (
    isUuidMessage &&
    !isDateMessage &&
    session.userId &&
    !session.reservationId &&
    !isSeatIdsMessage(lastUserMessage)
  ) {
    try {
      const bookingDetail = await booking.findById(lastUserMessage.trim());
      if (
        bookingDetail.userId === session.userId &&
        bookingDetail.status === 'CONFIRMED'
      ) {
        session.pendingCancelBookingId = bookingDetail.id;
        const prompt = buildCancelConfirmInput({
          movieTitle: bookingDetail.show.movie.title,
          showTime: bookingDetail.show.startTime,
        });
        return {
          toolCalls: [buildSyntheticUiPromptCall(prompt)],
          text: promptMessage(prompt),
        };
      }
    } catch {
      // Not a booking UUID — fall through to movie/show rules.
    }
  }

  // Rule 2: date chips after movie UUID selection (one picker only)
  if (
    isUuidMessage &&
    !isDateMessage &&
    !isShowUuidMessage
  ) {
    try {
      const movie = await catalog.findMovieById(lastUserMessage.trim());
      session.movieId = movie.id;
      session.selectedDate = null;
      session.showId = null;
      const dates = await catalog.findShowDatesByMovie(movie.id);

      if (dates.length === 0) {
        return {
          toolCalls,
          text: 'No upcoming showtimes for this movie. Try another film.',
        };
      }

      const existingDateInput = findDateChipPromptInput(toolCalls, executions);
      const prompt = existingDateInput
        ? { toolName: 'uiPrompt' as const, input: existingDateInput }
        : buildDateChoiceInput(dates);

      return {
        toolCalls: [buildSyntheticUiPromptCall(prompt)],
        text: promptMessage(prompt),
      };
    } catch {
      // Not a movie UUID — fall through to later rules.
    }
  }

  // Rule 2b: natural-language date browse ("any other date?")
  if (
    session.movieId &&
    !session.reservationId &&
    !session.showId &&
    isDateBrowseMessage(lastUserMessage) &&
    !hasDateChipPickerInTurn(toolCalls, executions)
  ) {
    const dateResponse = await buildDatePickerResponse(catalog, session.movieId);
    if (dateResponse) {
      return dateResponse;
    }

    return {
      toolCalls,
      text: 'No upcoming showtimes for this movie. Try another film.',
    };
  }

  // Rule 3 & 4: showtime dropdown after date + listShows (or fetch shows directly)
  const shouldOfferShows =
    session.movieId &&
    session.selectedDate &&
    !isShowUuidMessage &&
    (isDateMessage || Boolean(listShowsExecution?.result)) &&
    !hasShowChoiceGroupInTurn(toolCalls, executions);

  if (shouldOfferShows) {
    let shows: ShowChoiceSource[] = [];

    if (listShowsExecution?.result) {
      shows = parseShows(listShowsExecution.result);
    } else if (isDateMessage && session.selectedDate && session.movieId) {
      shows = await fetchShowsWithAvailability(
        catalog,
        session.movieId,
        session.selectedDate,
      );
    }

    if (shows.length > 0) {
      const prompt = buildShowPickerInput(shows);
      return {
        toolCalls: appendSyntheticToolCall(toolCalls, prompt),
        text: promptMessage(prompt),
      };
    }

    if (session.movieId) {
      const dates = await catalog.findShowDatesByMovie(session.movieId);
      if (dates.length > 0) {
        const message = session.selectedDate
          ? `No showtimes on ${session.selectedDate}. Pick another date:`
          : 'Pick a date:';
        const prompt = buildDateChoiceInput(dates, message);
        return {
          toolCalls: [buildSyntheticUiPromptCall(prompt)],
          text: promptMessage(prompt),
        };
      }

      return {
        toolCalls,
        text: 'No upcoming showtimes for this movie. Try another film.',
      };
    }
  }

  // Rule 6: confirm after successful hold
  const shouldAttemptHold =
    isSeatIdsMessage(lastUserMessage) ||
    Boolean(holdSeatsExecution) ||
    Boolean(findToolCallInput(toolCalls, 'holdSeats'));

  if (
    shouldAttemptHold &&
    !hasUiPromptOfType('confirm', toolCalls, executions) &&
    !isConfirmMessage &&
    !isCancelMessage
  ) {
    const holdDetails = await tryCompleteHold({
      session,
      lastUserMessage,
      holdSeatsExecution,
      toolCalls,
      reservation,
    });

    if (holdDetails) {
      const prompt = buildHoldConfirmInput({
        seatsHeld: holdDetails.seatsHeld,
        expiresAt: holdDetails.expiresAt,
      });
      return {
        toolCalls: [buildSyntheticUiPromptCall(prompt)],
        text: promptMessage(prompt),
      };
    }
  }

  // Rule 6b: hold failure -> refreshed seat picker
  if (
    holdSeatsExecution?.result &&
    isRecord(holdSeatsExecution.result) &&
    holdSeatsExecution.result.error &&
    session.showId
  ) {
    const seats = parseSeatList(holdSeatsExecution.result.currentSeatStates);
    const refreshedSeats =
      seats.length > 0
        ? seats
        : parseSeatList(await catalog.findShowSeats(session.showId));

    if (refreshedSeats.length > 0) {
      const prompt = buildSeatPickerInput(
        refreshedSeats,
        'One or more seats are no longer available. Pick another seat.',
      );
      return {
        toolCalls: [buildSyntheticUiPromptCall(prompt)],
        text: promptMessage(prompt),
      };
    }
  }

  if (
    shouldAttemptHold &&
    !session.reservationId &&
    session.showId &&
    !hasUiPromptOfType('seat_picker', toolCalls, executions)
  ) {
    const refreshedSeats = parseSeatList(
      await catalog.findShowSeats(session.showId),
    );
    if (refreshedSeats.length > 0) {
      const prompt = buildSeatPickerInput(
        refreshedSeats,
        'One or more seats are no longer available. Pick another seat.',
      );
      return {
        toolCalls: [buildSyntheticUiPromptCall(prompt)],
        text: promptMessage(prompt),
      };
    }
  }

  // Rule 8: cancel releases hold and restarts seat selection
  if (
    isCancelMessage &&
    session.pendingCancelBookingId &&
    !session.reservationId
  ) {
    session.pendingCancelBookingId = null;
    return {
      toolCalls,
      text: 'Booking cancellation aborted.',
    };
  }

  if (isCancelMessage && session.reservationId && session.showId) {
    if (session.reservationId) {
      await reservation.cancel(session.reservationId);
      session.reservationId = null;
    }

    const showSeats = await catalog.findShowSeats(session.showId);
    const seats = parseSeatList(showSeats);
    if (seats.length > 0) {
      const prompt = buildSeatPickerInput(
        seats,
        'Hold released. Pick another seat.',
      );
      return {
        toolCalls: [buildSyntheticUiPromptCall(prompt)],
        text: promptMessage(prompt),
      };
    }
  }

  // Rule 5: seat picker after getSeatMap
  if (
    getSeatMapExecution?.result &&
    !session.reservationId &&
    !hasUiPromptOfType('seat_picker', toolCalls, executions)
  ) {
    const seats = parseSeatMap(getSeatMapExecution.result);
    if (seats.length > 0) {
      const prompt = buildSeatPickerInput(seats);
      return {
        toolCalls: appendSyntheticToolCall(toolCalls, prompt),
        text: promptMessage(prompt),
      };
    }
  }

  // Rule 11: confirm cancels pending booking
  if (
    isConfirmMessage &&
    session.pendingCancelBookingId &&
    !session.reservationId
  ) {
    const cancelled = await tryCompleteCancelBooking({ session, booking });
    if (cancelled) {
      const markdown = buildCancelSuccessMarkdownInput(cancelled);
      return {
        toolCalls: [buildSyntheticUiMarkdownCall(markdown)],
        text: `Your booking for ${cancelled.movieTitle} has been cancelled.`,
      };
    }
  }

  // Rule 12: ticket after cancelBooking tool execution
  if (cancelBookingExecution?.result) {
    const cancelled = parseCancelBookingResult(cancelBookingExecution.result);
    if (cancelled) {
      const markdown = buildCancelSuccessMarkdownInput(cancelled);
      return {
        toolCalls: [buildSyntheticUiMarkdownCall(markdown)],
        text: `Your booking for ${cancelled.movieTitle} has been cancelled.`,
      };
    }
  }

  // Rule 7: ticket after confirmBooking (or enricher fallback on confirm message)
  if (confirmBookingExecution?.result) {
    const bookingResult = parseBookingResult(confirmBookingExecution.result);
    if (bookingResult) {
      const ticket = buildTicketMarkdownInput(bookingResult);
      return {
        toolCalls: [buildSyntheticUiMarkdownCall(ticket)],
        text: `Booking confirmed! REDIRECT:/booking/${bookingResult.bookingId}`,
      };
    }
  }

  if (isConfirmMessage && session.reservationId) {
    const bookingResult = await tryCompleteBooking({
      session,
      sessionId,
      booking,
    });
    if (bookingResult) {
      const ticket = buildTicketMarkdownInput(bookingResult);
      return {
        toolCalls: [buildSyntheticUiMarkdownCall(ticket)],
        text: `Booking confirmed! REDIRECT:/booking/${bookingResult.bookingId}`,
      };
    }
  }

  // Fallback: listShows ran with a selected date but show picker was skipped
  if (
    listShowsExecution?.result &&
    session.selectedDate &&
    !hasShowChoiceGroupInTurn(toolCalls, executions)
  ) {
    const shows = parseShows(listShowsExecution.result);
    if (shows.length > 0) {
      const prompt = buildShowPickerInput(shows);
      return {
        toolCalls: appendSyntheticToolCall(toolCalls, prompt),
        text: promptMessage(prompt),
      };
    }
  }

  return { toolCalls, text };
}
