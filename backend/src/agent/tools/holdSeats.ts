import { ConflictException } from '@nestjs/common';
import { z } from 'zod';
import {
  DEMO_FAST_HOLD_SECONDS,
  HOLD_TTL_MAX_SECONDS,
  HOLD_TTL_MIN_SECONDS,
} from '../../common/constants';
import type { BookingToolsContext } from './context';

/** Human seat labels like "A5", "H10". */
const SEAT_LABEL_PATTERN = /^[A-Za-z]+\d+$/;

export function createHoldSeatsTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({
    showId: z.string().uuid(),
    seatLabels: z.array(z.string()).min(1),
    holdDurationSeconds: z
      .number()
      .int()
      .min(HOLD_TTL_MIN_SECONDS)
      .max(HOLD_TTL_MAX_SECONDS)
      .optional(),
  });

  return {
    description:
      'Hold seats for the current session user. Always call getSeatMap first to resolve seatLabels (e.g. "A5").',
    inputSchema,
    execute: async ({
      showId,
      seatLabels,
      holdDurationSeconds,
    }: z.infer<typeof inputSchema>) => {
      if (!ctx.session.userId) {
        throw new Error(
          'User details are not set in this session. Call upsertUser first.',
        );
      }

      const invalid = seatLabels.filter((l) => !SEAT_LABEL_PATTERN.test(l));
      if (invalid.length > 0) {
        return {
          error: true,
          message:
            'holdSeats requires seatLabels from a prior getSeatMap call (e.g. "B5"). Call getSeatMap first, then present a seat_picker uiPrompt to the user.',
        };
      }

      const effectiveHoldDuration =
        process.env.DEMO_FAST_HOLD === 'true'
          ? DEMO_FAST_HOLD_SECONDS
          : holdDurationSeconds;

      try {
        const hold = await ctx.hold.createHold({
          userId: ctx.session.userId,
          showId,
          seatLabels,
          holdDurationSeconds: effectiveHoldDuration,
        });

        ctx.session.reservationId = hold.token;
        ctx.session.showId = showId;

        return {
          reservationId: hold.token,
          expiresAt: hold.expiresAt,
          seatsHeld: hold.seatLabels.length,
        };
      } catch (error) {
        if (error instanceof ConflictException) {
          const seatMap = await ctx.catalog.findShowSeats(showId);
          const currentSeatStates = seatMap.filter((seat) =>
            seatLabels.includes(seat.seatLabel),
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
