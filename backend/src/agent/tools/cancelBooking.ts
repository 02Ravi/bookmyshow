import { z } from 'zod';
import type { BookingToolsContext } from './context';

export function createCancelBookingTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({
    bookingId: z.string().uuid(),
  });

  return {
    description:
      'Cancel a confirmed booking for the current session user. Only use after the user confirms cancellation via uiPrompt.',
    inputSchema,
    execute: async ({ bookingId }: z.infer<typeof inputSchema>) => {
      if (!ctx.session.userId) {
        throw new Error('User details are not set in this session. Call upsertUser first.');
      }

      const booking = await ctx.booking.cancelBooking(
        bookingId,
        ctx.session.userId,
      );

      ctx.session.pendingCancelBookingId = null;

      return {
        bookingId: booking.id,
        status: booking.status,
        movieTitle: booking.show.movie.title,
        showTime: booking.show.startTime,
        seatsReleased: booking.seats.length,
      };
    },
  };
}
