import { z } from 'zod';
import type { BookingToolsContext } from './context';

export function createGetBookingTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({
    bookingId: z.string().uuid(),
  });

  return {
    description: 'Get full details for a specific booking.',
    inputSchema,
    execute: async ({ bookingId }: z.infer<typeof inputSchema>) => {
      const booking = await ctx.booking.findById(bookingId);

      return {
        bookingId: booking.id,
        status: booking.status,
        userId: booking.userId,
        createdAt: booking.createdAt,
        totalPrice: booking.totalPrice,
        show: booking.show,
        seats: booking.seats,
      };
    },
  };
}
