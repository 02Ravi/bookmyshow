import { BookingStatus, SeatType } from '../../generated/prisma/client';

export interface BookingMovieSummaryDto {
  id: string;
  title: string;
  posterUrl: string;
}

export interface BookingTheatreSummaryDto {
  id: string;
  name: string;
  city: string;
}

export interface BookingShowSummaryDto {
  id: string;
  startTime: Date;
  endTime: Date;
  movie: BookingMovieSummaryDto;
  theatre: BookingTheatreSummaryDto;
}

export interface BookingSeatDto {
  showSeatId: string;
  row: string;
  number: number;
  type: SeatType;
  price: string;
}

export interface BookingDetailDto {
  id: string;
  status: BookingStatus;
  idempotencyKey: string;
  reservationId: string;
  userId: string;
  createdAt: Date;
  show: BookingShowSummaryDto;
  seats: BookingSeatDto[];
}

export interface BookingListItemDto {
  id: string;
  status: BookingStatus;
  idempotencyKey: string;
  reservationId: string;
  userId: string;
  createdAt: Date;
  seatCount: number;
  show: BookingShowSummaryDto;
}

type BookingWithRelations = {
  id: string;
  status: BookingStatus;
  idempotencyKey: string;
  reservationId: string;
  userId: string;
  createdAt: Date;
  bookingSeats: Array<{
    showSeat: {
      id: string;
      price: { toString(): string };
      seat: { row: string; number: number; type: SeatType };
      show: {
        id: string;
        startTime: Date;
        endTime: Date;
        movie: { id: string; title: string; posterUrl: string };
        screen: {
          theatre: { id: string; name: string; city: string };
        };
      };
    };
  }>;
};

function mapShow(
  show: BookingWithRelations['bookingSeats'][0]['showSeat']['show'],
): BookingShowSummaryDto {
  return {
    id: show.id,
    startTime: show.startTime,
    endTime: show.endTime,
    movie: {
      id: show.movie.id,
      title: show.movie.title,
      posterUrl: show.movie.posterUrl,
    },
    theatre: {
      id: show.screen.theatre.id,
      name: show.screen.theatre.name,
      city: show.screen.theatre.city,
    },
  };
}

export function toBookingDetailDto(
  booking: BookingWithRelations,
): BookingDetailDto {
  const firstSeat = booking.bookingSeats[0]?.showSeat;
  if (!firstSeat) {
    throw new Error('Booking has no seats');
  }

  return {
    id: booking.id,
    status: booking.status,
    idempotencyKey: booking.idempotencyKey,
    reservationId: booking.reservationId,
    userId: booking.userId,
    createdAt: booking.createdAt,
    show: mapShow(firstSeat.show),
    seats: booking.bookingSeats.map((bs) => ({
      showSeatId: bs.showSeat.id,
      row: bs.showSeat.seat.row,
      number: bs.showSeat.seat.number,
      type: bs.showSeat.seat.type,
      price: bs.showSeat.price.toString(),
    })),
  };
}

export function toBookingListItemDto(
  booking: BookingWithRelations,
): BookingListItemDto {
  const firstSeat = booking.bookingSeats[0]?.showSeat;
  if (!firstSeat) {
    throw new Error('Booking has no seats');
  }

  return {
    id: booking.id,
    status: booking.status,
    idempotencyKey: booking.idempotencyKey,
    reservationId: booking.reservationId,
    userId: booking.userId,
    createdAt: booking.createdAt,
    seatCount: booking.bookingSeats.length,
    show: mapShow(firstSeat.show),
  };
}

export const bookingDetailInclude = {
  bookingSeats: {
    include: {
      showSeat: {
        include: {
          seat: true,
          show: {
            include: {
              movie: { select: { id: true, title: true, posterUrl: true } },
              screen: {
                include: {
                  theatre: { select: { id: true, name: true, city: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
