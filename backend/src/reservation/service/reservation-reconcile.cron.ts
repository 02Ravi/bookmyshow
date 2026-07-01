import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { RECONCILE_BATCH_SIZE } from '../../common/constants';
import { ReservationStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationReconcileService } from './reservation-reconcile.service';

const CRON_JOB_NAME = 'reservation-reconcile';

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
    const configured = this.configService.get<string>(
      'RECONCILE_CRON_INTERVAL',
    );
    const expression = configured?.trim() || CronExpression.EVERY_MINUTE;
    const job = new CronJob(expression, () => {
      void this.reconcileExpiredHolds().catch((err: unknown) => {
        this.logger.error('Reservation reconcile tick failed', err);
      });
    });
    this.schedulerRegistry.addCronJob(CRON_JOB_NAME, job);
    job.start();
    this.logger.log(
      `Registered cron job "${CRON_JOB_NAME}" with interval: ${expression}`,
    );
  }

  /** Reconciles all currently-expired ACTIVE reservations, draining batches within a single tick. */
  async reconcileExpiredHolds(): Promise<void> {
    let totalCandidates = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;

    while (true) {
      const candidates = await this.fetchExpiredCandidates();
      if (candidates === null) {
        // Query failed (e.g. database unreachable) — stop draining for this tick.
        break;
      }
      if (candidates.length === 0) {
        break;
      }

      const { succeeded, failed } = await this.reconcileBatch(candidates);
      totalCandidates += candidates.length;
      totalSucceeded += succeeded;
      totalFailed += failed;

      if (candidates.length < RECONCILE_BATCH_SIZE) {
        break;
      }
    }

    if (totalCandidates === 0) {
      this.logger.debug('No expired ACTIVE reservations to reconcile');
    } else {
      this.logger.log(
        `Reconciled ${totalSucceeded}/${totalCandidates} expired ACTIVE reservations (${totalFailed} failed)`,
      );
    }
  }

  private async fetchExpiredCandidates(): Promise<{ id: string }[] | null> {
    try {
      return await this.prisma.reservation.findMany({
        where: {
          status: ReservationStatus.ACTIVE,
          expiresAt: { lt: new Date() },
        },
        select: { id: true },
        take: RECONCILE_BATCH_SIZE,
      });
    } catch (err) {
      this.logger.error(
        'Could not query expired reservations (database unreachable?)',
        err,
      );
      return null;
    }
  }

  private async reconcileBatch(
    candidates: { id: string }[],
  ): Promise<{ succeeded: number; failed: number }> {
    const outcomes = await Promise.allSettled(
      candidates.map(({ id }) => this.reconcile.expireReservation(id)),
    );

    let succeeded = 0;
    let failed = 0;

    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        succeeded++;
      } else {
        failed++;
        this.logger.warn(
          `Failed to expire reservation ${candidates[index].id}`,
          outcome.reason,
        );
      }
    });

    return { succeeded, failed };
  }
}
