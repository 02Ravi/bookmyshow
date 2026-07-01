import { z } from 'zod';
import type { BookingToolsContext } from './context';

export function createGetSeatMapTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({
    showId: z.string().uuid(),
  });

  return {
    description:
      'Get the seat map for a show. Use this before holding seats so human seat labels can be resolved to showSeatIds.',
    inputSchema,
    execute: async ({ showId }: z.infer<typeof inputSchema>) => {
      const seats = await ctx.catalog.findShowSeats(showId);
      ctx.session.showId = showId;
      return { showId, seats };
    },
  };
}
