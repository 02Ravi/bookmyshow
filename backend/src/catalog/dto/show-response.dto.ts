import {
  MovieResponseDto,
  toMovieResponse,
} from './movie-response.dto';
import {
  TheatreResponseDto,
  toTheatreResponse,
} from './theatre-response.dto';

export interface ShowListItemDto {
  id: string;
  startTime: Date;
  endTime: Date;
  movieId: string;
  movieTitle: string;
  theatreId: string;
  theatreName: string;
  screenId: string;
  screenName: string;
}

export interface ShowDetailDto {
  id: string;
  startTime: Date;
  endTime: Date;
  movie: MovieResponseDto;
  screen: {
    id: string;
    name: string;
    theatre: TheatreResponseDto;
  };
}

export function toShowListItem(show: {
  id: string;
  startTime: Date;
  endTime: Date;
  movie: { id: string; title: string };
  screen: {
    id: string;
    name: string;
    theatre: { id: string; name: string };
  };
}): ShowListItemDto {
  return {
    id: show.id,
    startTime: show.startTime,
    endTime: show.endTime,
    movieId: show.movie.id,
    movieTitle: show.movie.title,
    theatreId: show.screen.theatre.id,
    theatreName: show.screen.theatre.name,
    screenId: show.screen.id,
    screenName: show.screen.name,
  };
}

export function toShowDetail(show: {
  id: string;
  startTime: Date;
  endTime: Date;
  movie: {
    id: string;
    title: string;
    durationMinutes: number;
    language: string;
    genre: string;
    posterUrl: string;
    createdAt: Date;
  };
  screen: {
    id: string;
    name: string;
    theatre: {
      id: string;
      name: string;
      city: string;
      address: string;
      createdAt: Date;
    };
  };
}): ShowDetailDto {
  return {
    id: show.id,
    startTime: show.startTime,
    endTime: show.endTime,
    movie: toMovieResponse(show.movie),
    screen: {
      id: show.screen.id,
      name: show.screen.name,
      theatre: toTheatreResponse(show.screen.theatre),
    },
  };
}
