import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { HoldService } from '../hold/service/hold.service';
import { PrismaService } from '../prisma/prisma.service';
import { showHoldsKey, holdTokenKey } from '../common/redis.keys';
import { RedisService } from '../redis/redis.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);

(hasDatabase ? describe : describe.skip)(
  'Booking idempotency (integration)',
  () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let redis: RedisService;
    let holdService: HoldService;

    let userId: string;
    let showId: string;
    let holdToken: string;
    let seatLabels: string[] = [];
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
      holdService = moduleFixture.get(HoldService);
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

      const show = await prisma.show.findFirst({
        include: { screen: true },
      });
      if (!show) {
        throw new Error('Need at least one Show in the database (run seed)');
      }
      showId = show.id;
      seatLabels = ['A1', 'A2'];

      const hold = await holdService.createHold({
        userId,
        showId,
        seatLabels,
        holdDurationSeconds: 120,
      });
      holdToken = hold.token;
    });

    afterEach(async () => {
      await prisma.bookedSeat.deleteMany({
        where: { booking: { idempotencyKey } },
      });
      await prisma.booking.deleteMany({ where: { idempotencyKey } });
      await prisma.user.deleteMany({ where: { id: userId } });
      if (seatLabels.length > 0) {
        await redis.getClient().zrem(showHoldsKey(showId), ...seatLabels);
      }
      if (holdToken) {
        await redis.getClient().del(holdTokenKey(holdToken));
      }
    });

    it('returns the same booking id when POST /bookings is called twice with the same idempotencyKey', async () => {
      const body = { holdToken, idempotencyKey };

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

      const booked = await prisma.bookedSeat.count({
        where: { bookingId: first.body.id },
      });
      expect(booked).toBe(2);
    });
  },
);
