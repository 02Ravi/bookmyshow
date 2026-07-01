import { z } from 'zod';
import type { BookingToolsContext } from './context';

export function createListMoviesTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({
    query: z.string().optional(),
  });

  return {
    description: 'List movies currently available for booking.',
    inputSchema,
    execute: async ({ query }: z.infer<typeof inputSchema>) => {
      const movies = await ctx.catalog.findAllMovies();
      const normalizedQuery = query?.trim().toLowerCase();

      const filtered = !normalizedQuery
        ? movies
        : movies.filter((movie) =>
            [movie.title, movie.genre, movie.language]
              .join(' ')
              .toLowerCase()
              .includes(normalizedQuery),
          );

      return filtered.map((movie) => ({
        id: movie.id,
        title: movie.title,
        genre: movie.genre,
        language: movie.language,
        durationMinutes: movie.durationMinutes,
        posterUrl: movie.posterUrl,
      }));
    },
  };
}
