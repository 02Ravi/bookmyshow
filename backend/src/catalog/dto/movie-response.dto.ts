export interface MovieResponseDto {
  id: string;
  title: string;
  durationMinutes: number;
  language: string;
  genre: string;
  posterUrl: string;
  createdAt: Date;
}

export function toMovieResponse(movie: {
  id: string;
  title: string;
  durationMinutes: number;
  language: string;
  genre: string;
  posterUrl: string;
  createdAt: Date;
}): MovieResponseDto {
  return {
    id: movie.id,
    title: movie.title,
    durationMinutes: movie.durationMinutes,
    language: movie.language,
    genre: movie.genre,
    posterUrl: movie.posterUrl,
    createdAt: movie.createdAt,
  };
}
