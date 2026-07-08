import { Injectable, NotFoundException } from '@nestjs/common';
import { Movie, Prisma, Theatre } from '../../generated/prisma/client';
import { HoldService } from '../../hold/service/hold.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ListShowsQueryDto } from '../dto/list-shows-query.dto';
import {
  ShowDetailDto,
  ShowListItemDto,
  toShowDetail,
  toShowListItem,
} from '../dto/show-response.dto';
import {
  ShowSeatResponseDto,
  type SeatStatus,
} from '../dto/show-seat-response.dto';
import { computeSeatsForScreen } from '../util/computeSeatsForScreen';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holdService: HoldService,
  ) {}

  async findAllMovies(): Promise<Movie[]> {
    return this.prisma.movie.findMany({
      orderBy: { title: 'asc' },
    });
  }

  async findMovieById(id: string): Promise<Movie> {
    const movie = await this.prisma.movie.findUnique({ where: { id } });
    if (!movie) {
      throw new NotFoundException(`Movie ${id} not found`);
    }
    return movie;
  }

  async findAllTheatres(): Promise<Theatre[]> {
    return this.prisma.theatre.findMany({
      orderBy: { name: 'asc' },
    });
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
    const show = await this.prisma.show.findUnique({
      where: { id: showId },
      include: { screen: true },
    });
    if (!show) {
      throw new NotFoundException(`Show ${showId} not found`);
    }

    const allSeats = computeSeatsForScreen(
      show.screen.layoutConfig,
      Number(show.basePrice),
    );

    const [bookedRows, heldLabels] = await Promise.all([
      this.prisma.bookedSeat.findMany({
        where: { showId },
        select: { seatLabel: true },
      }),
      this.holdService.getHeldSeats(showId),
    ]);

    const bookedSet = new Set(bookedRows.map((b) => b.seatLabel));
    const heldSet = new Set(heldLabels);

    return allSeats.map((seat) => {
      let status: SeatStatus = 'AVAILABLE';
      if (bookedSet.has(seat.seatLabel)) {
        status = 'BOOKED';
      } else if (heldSet.has(seat.seatLabel)) {
        status = 'HELD';
      }

      return {
        seatLabel: seat.seatLabel,
        row: seat.row,
        number: seat.number,
        type: seat.type,
        status,
        price: seat.price.toFixed(2),
      };
    });
  }
}
