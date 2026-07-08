import { z } from 'zod';
import type { BookingToolsContext } from './context';

export function createGetSeatMapTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({
    showId: z.string().uuid(),
  });

  return {
    description:
      'Get the seat map for a show. Use this before holding seats so seatLabels (e.g. "A5") can be selected.',
    inputSchema,
    execute: async ({ showId }: z.infer<typeof inputSchema>) => {
      const seats = await ctx.catalog.findShowSeats(showId);
      ctx.session.showId = showId;
      return { showId, seats };
    },
  };
}
