/**
 * One-off smoke test: backdate an ACTIVE reservation and run reconcileExpiredHolds().
 * Usage: npm run build && node scripts/smoke-reconcile-cron.mjs
 */
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../dist/src/app.module.js';
import { PrismaService } from '../dist/src/prisma/prisma.service.js';
import { ReservationReconcileCron } from '../dist/src/reservation/service/reservation-reconcile.cron.js';
import {
  ReservationStatus,
  ShowSeatStatus,
} from '../dist/src/generated/prisma/client.js';

const moduleFixture = await Test.createTestingModule({
  imports: [AppModule],
}).compile();
const app = moduleFixture.createNestApplication();
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
await app.init();

const prisma = moduleFixture.get(PrismaService);

const showSeat = await prisma.showSeat.findFirst({
  where: { status: ShowSeatStatus.AVAILABLE },
});
if (!showSeat) {
  throw new Error('No AVAILABLE show seat found');
}

const user = await prisma.user.create({
  data: {
    email: `cron-smoke-${Date.now()}@example.com`,
    name: 'Cron Smoke',
  },
});

const reservation = await prisma.reservation.create({
  data: {
    userId: user.id,
    status: ReservationStatus.ACTIVE,
    expiresAt: new Date(Date.now() - 60_000),
    reservationSeats: { create: [{ showSeatId: showSeat.id }] },
  },
});

await prisma.showSeat.update({
  where: { id: showSeat.id },
  data: { status: ShowSeatStatus.HELD, version: { increment: 1 } },
});

const cron = moduleFixture.get(ReservationReconcileCron);
await cron.reconcileExpiredHolds();

const afterSeat = await prisma.showSeat.findUnique({ where: { id: showSeat.id } });
const afterReservation = await prisma.reservation.findUnique({
  where: { id: reservation.id },
});

console.log('seat status:', afterSeat?.status);
console.log('reservation status:', afterReservation?.status);

await prisma.reservationSeat.deleteMany({ where: { reservationId: reservation.id } });
await prisma.reservation.delete({ where: { id: reservation.id } });
await prisma.user.delete({ where: { id: user.id } });
await app.close();

if (afterSeat?.status !== ShowSeatStatus.AVAILABLE) {
  process.exit(1);
}
if (afterReservation?.status !== ReservationStatus.EXPIRED) {
  process.exit(1);
}
console.log('smoke-reconcile-cron: OK');
