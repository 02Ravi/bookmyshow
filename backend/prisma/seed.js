"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("../src/generated/prisma/client");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is required');
}
const prisma = new client_1.PrismaClient({
    adapter: new adapter_pg_1.PrismaPg({ connectionString }),
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
function addDays(date, days) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}
function setShowTime(base, hour, minute) {
    const result = new Date(base);
    result.setUTCHours(hour, minute, 0, 0);
    return result;
}
function seatPrice(type) {
    return type === client_1.SeatType.PREMIUM ? '350.00' : '200.00';
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
    const movies = await Promise.all(MOVIES.map((movie) => prisma.movie.create({ data: movie })));
    const theatres = await Promise.all(THEATRES.map((theatre) => prisma.theatre.create({ data: theatre })));
    const screens = await Promise.all(theatres.map((theatre) => prisma.screen.create({
        data: {
            theatreId: theatre.id,
            name: 'Screen 1',
        },
    })));
    const seatsByScreen = new Map();
    for (const screen of screens) {
        const seats = [];
        for (const row of ROWS) {
            for (let number = 1; number <= SEATS_PER_ROW; number++) {
                const type = row === 'E' ? client_1.SeatType.PREMIUM : client_1.SeatType.REGULAR;
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
    for (const screen of screens) {
        for (const movie of movies) {
            for (const slot of showSlots) {
                const day = addDays(today, slot.dayOffset);
                const startTime = setShowTime(day, slot.hour, slot.minute);
                const endTime = new Date(startTime.getTime() + movie.durationMinutes * 60 * 1000);
                const show = await prisma.show.create({
                    data: {
                        movieId: movie.id,
                        screenId: screen.id,
                        startTime,
                        endTime,
                    },
                });
                const seats = seatsByScreen.get(screen.id);
                await prisma.showSeat.createMany({
                    data: seats.map((seat) => ({
                        showId: show.id,
                        seatId: seat.id,
                        status: client_1.ShowSeatStatus.AVAILABLE,
                        price: seatPrice(seat.type),
                    })),
                });
            }
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
        shows: movies.length * screens.length * showSlots.length,
        showSeats: movies.length * screens.length * showSlots.length * ROWS.length * SEATS_PER_ROW,
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
//# sourceMappingURL=seed.js.map