import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ReservationStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationReconcileService } from './reservation-reconcile.service';

const CRON_JOB_NAME = 'reservation-reconcile';
const BATCH_SIZE = 100;

@Injectable()
export class ReservationReconcileCron implements OnModuleInit {
  private readonly logger = new Logger(ReservationReconcileCron.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly reconcile: ReservationReconcileService,
  ) {}

  onModuleInit(): void {
    const configured = this.configService.get<string>('RECONCILE_CRON_INTERVAL');
    const expression = configured?.trim() || CronExpression.EVERY_MINUTE;
    const job = new CronJob(expression, () => {
      void this.reconcileExpiredHolds();
    });
    this.schedulerRegistry.addCronJob(CRON_JOB_NAME, job);
    job.start();
    this.logger.log(`Registered cron job "${CRON_JOB_NAME}" with interval: ${expression}`);
  }

  async reconcileExpiredHolds(): Promise<void> {
    const candidates = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: { lt: new Date() },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });

    let succeeded = 0;
    let failed = 0;

    for (const { id } of candidates) {
      try {
        await this.reconcile.expireReservation(id);
        succeeded++;
      } catch (err) {
        failed++;
        this.logger.warn(`Failed to expire reservation ${id}`, err);
      }
    }

    if (candidates.length === 0) {
      this.logger.debug('No expired ACTIVE reservations to reconcile');
    } else {
      this.logger.log(
        `Reconciled ${succeeded}/${candidates.length} expired ACTIVE reservations (${failed} failed)`,
      );
    }
  }
}
