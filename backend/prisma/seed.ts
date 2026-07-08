import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

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
/** Base ticket price in INR — multipliers in layoutConfig derive tier prices. */
const BASE_PRICE = '200.00';

const LAYOUT_CONFIG = {
  rows: [
    { row: 'A', seats: 10, type: 'REGULAR', priceMultiplier: 1 },
    { row: 'B', seats: 10, type: 'REGULAR', priceMultiplier: 1 },
    { row: 'C', seats: 10, type: 'REGULAR', priceMultiplier: 1 },
    { row: 'D', seats: 10, type: 'REGULAR', priceMultiplier: 1 },
    { row: 'E', seats: 10, type: 'REGULAR', priceMultiplier: 1 },
    { row: 'F', seats: 10, type: 'PREMIUM', priceMultiplier: 1.75 },
    { row: 'G', seats: 10, type: 'PREMIUM', priceMultiplier: 1.75 },
    { row: 'H', seats: 10, type: 'RECLINER', priceMultiplier: 2.25 },
  ],
};

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

async function main() {
  await prisma.bookedSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.show.deleteMany();
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
          layoutConfig: LAYOUT_CONFIG,
        },
      }),
    ),
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let showCount = 0;

  for (const movie of movies) {
    for (const screen of screens) {
      for (let dayOffset = 0; dayOffset < DAYS_AHEAD; dayOffset++) {
        for (const hour of SHOW_HOURS) {
          const day = addDays(today, dayOffset);
          const startTime = setShowTime(day, hour, 0);
          const endTime = new Date(
            startTime.getTime() + movie.durationMinutes * 60 * 1000,
          );

          await prisma.show.create({
            data: {
              movieId: movie.id,
              screenId: screen.id,
              startTime,
              endTime,
              basePrice: BASE_PRICE,
            },
          });

          showCount += 1;
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

  const seatsPerScreen = LAYOUT_CONFIG.rows.reduce(
    (sum, row) => sum + row.seats,
    0,
  );

  console.log('Seed complete:', {
    movies: movies.length,
    theatres: theatres.length,
    screens: screens.length,
    daysAhead: DAYS_AHEAD,
    slotsPerDay: SHOW_HOURS.length,
    seatsPerScreen,
    shows: showCount,
    layoutConfig: 'stored on Screen (no Seat/ShowSeat rows)',
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
