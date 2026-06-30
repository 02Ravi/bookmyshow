import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { seatHoldKey } from '../common/redis-hold.keys';
import {
  ReservationStatus,
  ShowSeatStatus,
} from '../generated/prisma/client';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)(
  'Booking idempotency (integration)',
  () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let redis: RedisService;

    let userId: string;
    let reservationId: string;
    let showSeatIds: string[] = [];
    const idempotencyKey = `test-idem-${Date.now()}`;

    beforeAll(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();

      prisma = moduleFixture.get(PrismaService);
      redis = moduleFixture.get(RedisService);
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: {
          email: `booking-test-${Date.now()}@example.com`,
          name: 'Booking Test User',
        },
      });
      userId = user.id;

      const showSeats = await prisma.showSeat.findMany({
        where: { status: ShowSeatStatus.AVAILABLE },
        take: 2,
      });

      if (showSeats.length < 2) {
        throw new Error('Need at least 2 AVAILABLE show seats in the database');
      }

      showSeatIds = showSeats.map((s) => s.id);

      await prisma.showSeat.updateMany({
        where: { id: { in: showSeatIds } },
        data: { status: ShowSeatStatus.HELD },
      });

      const reservation = await prisma.reservation.create({
        data: {
          userId,
          status: ReservationStatus.ACTIVE,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          reservationSeats: {
            create: showSeatIds.map((showSeatId) => ({ showSeatId })),
          },
        },
      });
      reservationId = reservation.id;

      for (const showSeatId of showSeatIds) {
        await redis.getClient().set(seatHoldKey(showSeatId), reservationId);
      }
    });

    afterEach(async () => {
      await prisma.bookingSeat.deleteMany({
        where: { booking: { reservationId } },
      });
      await prisma.booking.deleteMany({ where: { reservationId } });
      await prisma.reservationSeat.deleteMany({ where: { reservationId } });
      await prisma.reservation.deleteMany({ where: { id: reservationId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.showSeat.updateMany({
        where: { id: { in: showSeatIds } },
        data: { status: ShowSeatStatus.AVAILABLE },
      });
      if (showSeatIds.length > 0) {
        await redis.deleteHoldKeys(showSeatIds);
      }
    });

    it('returns the same booking id when POST /bookings is called twice with the same idempotencyKey', async () => {
      const body = { reservationId, idempotencyKey };

      const first = await request(app.getHttpServer())
        .post('/bookings')
        .send(body)
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/bookings')
        .send(body)
        .expect(200);

      expect(first.body.id).toBe(second.body.id);

      const count = await prisma.booking.count({
        where: { idempotencyKey },
      });
      expect(count).toBe(1);
    });
  },
);
