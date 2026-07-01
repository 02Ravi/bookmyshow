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

/** How many days of showtimes to generate (starting today, UTC). */
const DAYS_AHEAD = 14;
/** Show start hours per day (UTC). */
const SHOW_HOURS = [10, 14, 18, 21];

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SEATS_PER_ROW = 10;

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
  {
    name: 'Cinepolis Orion',
    city: 'Mumbai',
    address: 'Goregaon, Mumbai',
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
  if (type === SeatType.PREMIUM) return '350.00';
  if (type === SeatType.RECLINER) return '450.00';
  return '200.00';
}

function seatTypeForRow(row: string): SeatType {
  if (row === 'H') return SeatType.RECLINER;
  if (row === 'G' || row === 'F') return SeatType.PREMIUM;
  return SeatType.REGULAR;
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
      const type = seatTypeForRow(row);
      for (let number = 1; number <= SEATS_PER_ROW; number++) {
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

  let showCount = 0;
  let showSeatCount = 0;

  for (const movie of movies) {
    for (const screen of screens) {
      const seats = seatsByScreen.get(screen.id)!;

      for (let dayOffset = 0; dayOffset < DAYS_AHEAD; dayOffset++) {
        for (const hour of SHOW_HOURS) {
          const day = addDays(today, dayOffset);
          const startTime = setShowTime(day, hour, 0);
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

          showCount += 1;
          showSeatCount += seats.length;
        }
      }
    }
  }

  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@bookmyshow.com',
      name: 'Demo User',
    },
  });

  const seatsPerScreen = ROWS.length * SEATS_PER_ROW;

  console.log('Seed complete:', {
    movies: movies.length,
    theatres: theatres.length,
    screens: screens.length,
    daysAhead: DAYS_AHEAD,
    slotsPerDay: SHOW_HOURS.length,
    seatsPerScreen,
    shows: showCount,
    showSeats: showSeatCount,
    allSeatsStatus: 'AVAILABLE',
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
