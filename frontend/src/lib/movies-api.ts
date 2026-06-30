import { api } from '@/lib/api';

export interface Movie {
  id: string;
  title: string;
  durationMinutes: number;
  language: string;
  genre: string;
  posterUrl: string;
  createdAt: string;
}

export interface Theatre {
  id: string;
  name: string;
  city: string;
  address: string;
  createdAt: string;
}

export interface Show {
  id: string;
  startTime: string;
  endTime: string;
  movieId: string;
  movieTitle: string;
  theatreId: string;
  theatreName: string;
  screenId: string;
  screenName: string;
}

export interface ShowDetail {
  id: string;
  startTime: string;
  endTime: string;
  movie: Movie;
  screen: {
    id: string;
    name: string;
    theatre: Theatre;
  };
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
}

export async function fetchMovies(): Promise<Movie[]> {
  const { data } = await api.get<Movie[]>('/movies');
  return data;
}

export async function fetchMovieById(id: string): Promise<Movie> {
  const { data } = await api.get<Movie>(`/movies/${id}`);
  return data;
}

export async function fetchShowsByMovie(movieId: string): Promise<Show[]> {
  const { data } = await api.get<Show[]>('/shows', { params: { movieId } });
  return data;
}

export async function fetchShowById(id: string): Promise<ShowDetail> {
  const { data } = await api.get<ShowDetail>(`/shows/${id}`);
  return data;
}

export async function upsertUser(payload: {
  name: string;
  email: string;
  phone?: string;
}): Promise<UserDto> {
  const { data } = await api.post<UserDto>('/auth/upsert', payload);
  return data;
}
