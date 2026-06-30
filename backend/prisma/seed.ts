import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, SeatType, ShowSeatStatus } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ROWS = ['A', 'B', 'C', 'D', 'E'];
const SEATS_PER_ROW = 6;

const MOVIES = [
  {
    title: 'Interstellar',
    durationMinutes: 169,
    language: 'English',
    genre: 'Sci-Fi',
    posterUrl: 'https://placehold.co/300x450?text=Interstellar',
  },
  {
    title: '3 Idiots',
    durationMinutes: 170,
    language: 'Hindi',
    genre: 'Comedy',
    posterUrl: 'https://placehold.co/300x450?text=3+Idiots',
  },
  {
    title: 'RRR',
    durationMinutes: 182,
    language: 'Telugu',
    genre: 'Action',
    posterUrl: 'https://placehold.co/300x450?text=RRR',
  },
];

const THEATRES = [
  {
    name: 'PVR Phoenix',
    city: 'Mumbai',
    address: 'Lower Parel, Mumbai',
  },
  {
    name: 'INOX Forum',
    city: 'Bangalore',
    address: 'Koramangala, Bangalore',
  },
];

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function setShowTime(base: Date, hour: number, minute: number): Date {
  const result = new Date(base);
  result.setUTCHours(hour, minute, 0, 0);
  return result;
}

function seatPrice(type: SeatType): string {
  return type === SeatType.PREMIUM ? '350.00' : '200.00';
}

async function main() {
  await prisma.bookingSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.reservationSeat.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.showSeat.deleteMany();
  await prisma.show.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.screen.deleteMany();
  await prisma.theatre.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.user.deleteMany();

  const movies = await Promise.all(
    MOVIES.map((movie) => prisma.movie.create({ data: movie })),
  );

  const theatres = await Promise.all(
    THEATRES.map((theatre) => prisma.theatre.create({ data: theatre })),
  );

  const screens = await Promise.all(
    theatres.map((theatre) =>
      prisma.screen.create({
        data: {
          theatreId: theatre.id,
          name: 'Screen 1',
        },
      }),
    ),
  );

  const seatsByScreen = new Map<string, { id: string; type: SeatType }[]>();

  for (const screen of screens) {
    const seats: { id: string; type: SeatType }[] = [];

    for (const row of ROWS) {
      for (let number = 1; number <= SEATS_PER_ROW; number++) {
        const type = row === 'E' ? SeatType.PREMIUM : SeatType.REGULAR;
        const seat = await prisma.seat.create({
          data: {
            screenId: screen.id,
            row,
            number,
            type,
          },
        });
        seats.push({ id: seat.id, type: seat.type });
      }
    }

    seatsByScreen.set(screen.id, seats);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const showSlots = [
    { dayOffset: 0, hour: 18, minute: 0 },
    { dayOffset: 1, hour: 21, minute: 0 },
  ];

  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i];
    const movie = movies[i % movies.length];
    const seats = seatsByScreen.get(screen.id)!;

    for (const slot of showSlots) {
      const day = addDays(today, slot.dayOffset);
      const startTime = setShowTime(day, slot.hour, slot.minute);
      const endTime = new Date(
        startTime.getTime() + movie.durationMinutes * 60 * 1000,
      );

      const show = await prisma.show.create({
        data: {
          movieId: movie.id,
          screenId: screen.id,
          startTime,
          endTime,
        },
      });

      await prisma.showSeat.createMany({
        data: seats.map((seat) => ({
          showId: show.id,
          seatId: seat.id,
          status: ShowSeatStatus.AVAILABLE,
          price: seatPrice(seat.type),
        })),
      });
    }
  }

  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@bookmyshow.com',
      name: 'Demo User',
    },
  });

  console.log('Seed complete:', {
    movies: movies.length,
    theatres: theatres.length,
    screens: screens.length,
    shows: screens.length * showSlots.length,
    showSeats: screens.length * showSlots.length * ROWS.length * SEATS_PER_ROW,
    demoUserId: demoUser.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
