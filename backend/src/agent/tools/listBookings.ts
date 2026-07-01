import { z } from 'zod';
import type { BookingToolsContext } from './context';

export function createListBookingsTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({});

  return {
    description: 'List bookings for the current session user.',
    inputSchema,
    execute: async () => {
      if (!ctx.session.userId) {
        throw new Error('User details are not set in this session. Call upsertUser first.');
      }

      const bookings = await ctx.booking.findByUserId(ctx.session.userId);

      return bookings.map((booking) => ({
        bookingId: booking.id,
        movieTitle: booking.show.movie.title,
        showTime: booking.show.startTime,
        seatCount: booking.seatCount,
        status: booking.status,
        createdAt: booking.createdAt,
      }));
    },
  };
}
