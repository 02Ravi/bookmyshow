import { z } from 'zod';
import type { BookingToolsContext } from './context';

export function createConfirmBookingTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({});

  return {
    description:
      'Confirm the active reservation in this session and create a booking.',
    inputSchema,
    execute: async () => {
      if (!ctx.session.reservationId) {
        throw new Error('There is no active reservation in this session to confirm.');
      }

      const result = await ctx.booking.createFromReservation({
        reservationId: ctx.session.reservationId,
        idempotencyKey: `agent-${ctx.sessionId}-${Date.now()}`,
      });

      ctx.session.reservationId = null;

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
    },
  };
}
