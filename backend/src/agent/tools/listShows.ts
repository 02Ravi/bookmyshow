import { z } from 'zod';
import type { BookingToolsContext } from './context';

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createListShowsTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({
    movieId: z.string().uuid(),
    date: z.string().optional(),
  });

  return {
    description:
      'List shows for a movie on a date, including how many seats are still available.',
    inputSchema,
    execute: async ({ movieId, date }: z.infer<typeof inputSchema>) => {
      const selectedDate = date?.trim() || getTodayDateString();
      const shows = await ctx.catalog.findShows({ movieId, date: selectedDate });

      const availability = await Promise.all(
        shows.map(async (show) => {
          const seats = await ctx.catalog.findShowSeats(show.id);
          return {
            id: show.id,
            startTime: show.startTime,
            endTime: show.endTime,
            theatreName: show.theatreName,
            screenName: show.screenName,
            availableSeats: seats.filter((seat) => seat.status === 'AVAILABLE')
              .length,
          };
        }),
      );

      return availability;
    },
  };
}
