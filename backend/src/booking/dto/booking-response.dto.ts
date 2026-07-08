import { BookingStatus } from '../../generated/prisma/client';

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
  seatLabel: string;
  row: string;
  number: number;
  type: string;
  price: string;
}

export interface BookingDetailDto {
  id: string;
  status: BookingStatus;
  idempotencyKey: string;
  totalPrice: string;
  userId: string;
  createdAt: Date;
  show: BookingShowSummaryDto;
  seats: BookingSeatDto[];
}

export interface BookingListItemDto {
  id: string;
  status: BookingStatus;
  idempotencyKey: string;
  totalPrice: string;
  userId: string;
  createdAt: Date;
  seatCount: number;
  show: BookingShowSummaryDto;
}

type BookingWithRelations = {
  id: string;
  status: BookingStatus;
  idempotencyKey: string;
  totalPrice: { toString(): string };
  userId: string;
  createdAt: Date;
  bookedSeats: Array<{
    seatLabel: string;
    type: string;
    price: { toString(): string };
    show: {
      id: string;
      startTime: Date;
      endTime: Date;
      movie: { id: string; title: string; posterUrl: string };
      screen: {
        theatre: { id: string; name: string; city: string };
      };
    };
  }>;
};

function parseSeatLabel(seatLabel: string): { row: string; number: number } {
  const match = /^([A-Za-z]+)(\d+)$/.exec(seatLabel);
  if (!match) {
    return { row: seatLabel, number: 0 };
  }
  return { row: match[1], number: Number(match[2]) };
}

function mapShow(
  show: BookingWithRelations['bookedSeats'][0]['show'],
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
  const firstSeat = booking.bookedSeats[0];
  if (!firstSeat) {
    throw new Error('Booking has no seats');
  }

  return {
    id: booking.id,
    status: booking.status,
    idempotencyKey: booking.idempotencyKey,
    totalPrice: booking.totalPrice.toString(),
    userId: booking.userId,
    createdAt: booking.createdAt,
    show: mapShow(firstSeat.show),
    seats: booking.bookedSeats.map((bs) => {
      const { row, number } = parseSeatLabel(bs.seatLabel);
      return {
        seatLabel: bs.seatLabel,
        row,
        number,
        type: bs.type,
        price: bs.price.toString(),
      };
    }),
  };
}

export function toBookingListItemDto(
  booking: BookingWithRelations,
): BookingListItemDto {
  const firstSeat = booking.bookedSeats[0];
  if (!firstSeat) {
    throw new Error('Booking has no seats');
  }

  return {
    id: booking.id,
    status: booking.status,
    idempotencyKey: booking.idempotencyKey,
    totalPrice: booking.totalPrice.toString(),
    userId: booking.userId,
    createdAt: booking.createdAt,
    seatCount: booking.bookedSeats.length,
    show: mapShow(firstSeat.show),
  };
}

export const bookingDetailInclude = {
  bookedSeats: {
    include: {
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
} as const;
