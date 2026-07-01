import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListShowsQueryDto } from '../dto/list-shows-query.dto';
import {
  MovieResponseDto,
  toMovieResponse,
} from '../dto/movie-response.dto';
import {
  ShowDetailDto,
  ShowListItemDto,
  toShowDetail,
  toShowListItem,
} from '../dto/show-response.dto';
import {
  TheatreResponseDto,
  toTheatreResponse,
} from '../dto/theatre-response.dto';
import {
  ShowSeatResponseDto,
  toShowSeatResponse,
} from '../dto/show-seat-response.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllMovies(): Promise<MovieResponseDto[]> {
    const movies = await this.prisma.movie.findMany({
      orderBy: { title: 'asc' },
    });
    return movies.map(toMovieResponse);
  }

  async findMovieById(id: string): Promise<MovieResponseDto> {
    const movie = await this.prisma.movie.findUnique({ where: { id } });
    if (!movie) {
      throw new NotFoundException(`Movie ${id} not found`);
    }
    return toMovieResponse(movie);
  }

  async findAllTheatres(): Promise<TheatreResponseDto[]> {
    const theatres = await this.prisma.theatre.findMany({
      orderBy: { name: 'asc' },
    });
    return theatres.map(toTheatreResponse);
  }

  async findShows(query: ListShowsQueryDto): Promise<ShowListItemDto[]> {
    const where: Prisma.ShowWhereInput = {};

    if (query.movieId) {
      where.movieId = query.movieId;
    }

    if (query.theatreId) {
      where.screen = { theatreId: query.theatreId };
    }

    if (query.date) {
      const dayStart = new Date(`${query.date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      where.startTime = { gte: dayStart, lt: dayEnd };
    }

    const shows = await this.prisma.show.findMany({
      where,
      include: {
        movie: { select: { id: true, title: true } },
        screen: {
          select: {
            id: true,
            name: true,
            theatre: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return shows.map(toShowListItem);
  }

  async findShowDatesByMovie(movieId: string): Promise<string[]> {
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);

    const shows = await this.prisma.show.findMany({
      where: {
        movieId,
        startTime: { gte: startOfTodayUtc },
      },
      select: { startTime: true },
      orderBy: { startTime: 'asc' },
    });

    const dates = new Set<string>();
    for (const show of shows) {
      dates.add(show.startTime.toISOString().slice(0, 10));
    }

    return [...dates].sort();
  }

  async findShowById(id: string): Promise<ShowDetailDto> {
    const show = await this.prisma.show.findUnique({
      where: { id },
      include: {
        movie: true,
        screen: { include: { theatre: true } },
      },
    });

    if (!show) {
      throw new NotFoundException(`Show ${id} not found`);
    }

    return toShowDetail(show);
  }

  async findShowSeats(showId: string): Promise<ShowSeatResponseDto[]> {
    const show = await this.prisma.show.findUnique({ where: { id: showId } });
    if (!show) {
      throw new NotFoundException(`Show ${showId} not found`);
    }

    const showSeats = await this.prisma.showSeat.findMany({
      where: { showId },
      include: {
        seat: { select: { row: true, number: true, type: true } },
      },
      orderBy: [{ seat: { row: 'asc' } }, { seat: { number: 'asc' } }],
    });

    return showSeats.map(toShowSeatResponse);
  }
}
