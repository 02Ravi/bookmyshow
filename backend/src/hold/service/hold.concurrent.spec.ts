import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { HoldService } from './hold.service';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { showHoldsKey } from '../../common/redis.keys';

const hasRedis = true;

(hasRedis ? describe : describe.skip)('HoldService concurrent holds', () => {
  let holdService: HoldService;
  let redis: RedisService;
  const showId = `concurrent-test-show-${Date.now()}`;
  const seatLabels = ['Z99'];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })],
      providers: [
        HoldService,
        RedisService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: RealtimeService,
          useValue: {
            emitSeatHeld: jest.fn(),
            emitSeatReleased: jest.fn(),
            emitSeatBooked: jest.fn(),
          },
        },
      ],
    }).compile();

    holdService = moduleFixture.get(HoldService);
    redis = moduleFixture.get(RedisService);
  });

  afterAll(async () => {
    await redis.getClient().del(showHoldsKey(showId));
    await redis.onModuleDestroy();
  });

  beforeEach(async () => {
    await redis.getClient().del(showHoldsKey(showId));
  });

  it('allows exactly one of two parallel holds for the same seatLabel', async () => {
    const [a, b] = await Promise.all([
      holdService.tryHoldSeats(showId, seatLabels, 60),
      holdService.tryHoldSeats(showId, seatLabels, 60),
    ]);

    const successes = [a, b].filter(Boolean).length;
    expect(successes).toBe(1);

    const held = await holdService.getHeldSeats(showId);
    expect(held).toEqual(seatLabels);
  });
});
