import { ConflictException } from '@nestjs/common';
import { z } from 'zod';
import {
  DEMO_FAST_HOLD_SECONDS,
  HOLD_TTL_MAX_SECONDS,
  HOLD_TTL_MIN_SECONDS,
} from '../../common/constants';
import type { BookingToolsContext } from './context';
import { assertUuid } from './utils';

export function createHoldSeatsTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({
    showId: z.string().uuid(),
    showSeatIds: z.array(z.string()).min(1),
    holdDurationSeconds: z
      .number()
      .int()
      .min(HOLD_TTL_MIN_SECONDS)
      .max(HOLD_TTL_MAX_SECONDS)
      .optional(),
  });

  return {
    description:
      'Hold seats for the current session user. Always call getSeatMap first to resolve showSeatIds.',
    inputSchema,
    execute: async ({
      showId,
      showSeatIds,
      holdDurationSeconds,
    }: z.infer<typeof inputSchema>) => {
      if (!ctx.session.userId) {
        throw new Error(
          'User details are not set in this session. Call upsertUser first.',
        );
      }

      try {
        showSeatIds.forEach((id) => assertUuid(id, 'showSeatIds'));
      } catch {
        return {
          error: true,
          message:
            'holdSeats requires UUID showSeatIds from a prior getSeatMap call. Human seat labels like "B5" are not valid. Call getSeatMap first, then present a seat_picker uiPrompt to the user.',
        };
      }

      const effectiveHoldDuration =
        process.env.DEMO_FAST_HOLD === 'true'
          ? DEMO_FAST_HOLD_SECONDS
          : holdDurationSeconds;

      try {
        const reservation = await ctx.reservation.create({
          userId: ctx.session.userId,
          showId,
          showSeatIds,
          holdDurationSeconds: effectiveHoldDuration,
        });

        ctx.session.reservationId = reservation.id;
        ctx.session.showId = showId;

        return {
          reservationId: reservation.id,
          expiresAt: reservation.expiresAt,
          seatsHeld: reservation.showSeatIds.length,
        };
      } catch (error) {
        if (error instanceof ConflictException) {
          const seatMap = await ctx.catalog.findShowSeats(showId);
          const currentSeatStates = seatMap.filter((seat) =>
            showSeatIds.includes(seat.showSeatId),
          );

          return {
            error:
              'One or more seats are no longer available. Please choose another option from the refreshed seat map.',
            currentSeatStates,
          };
        }

        throw error;
      }
    },
  };
}
