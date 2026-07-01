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

export interface ShowDetailMovieDto {
  id: string;
  title: string;
  durationMinutes: number;
  language: string;
  genre: string;
  posterUrl: string;
  createdAt: Date;
}

export interface ShowDetailTheatreDto {
  id: string;
  name: string;
  city: string;
  address: string;
  createdAt: Date;
}

export interface ShowDetailDto {
  id: string;
  startTime: Date;
  endTime: Date;
  movie: ShowDetailMovieDto;
  screen: {
    id: string;
    name: string;
    theatre: ShowDetailTheatreDto;
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
  movie: ShowDetailMovieDto;
  screen: {
    id: string;
    name: string;
    theatre: ShowDetailTheatreDto;
  };
}): ShowDetailDto {
  return {
    id: show.id,
    startTime: show.startTime,
    endTime: show.endTime,
    movie: { ...show.movie },
    screen: {
      id: show.screen.id,
      name: show.screen.name,
      theatre: { ...show.screen.theatre },
    },
  };
}
