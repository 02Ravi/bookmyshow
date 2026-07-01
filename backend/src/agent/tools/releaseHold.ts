import { ConflictException, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import type { BookingToolsContext } from './context';

export function createReleaseHoldTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({});

  return {
    description:
      'Release the currently active seat hold in this session, if one exists.',
    inputSchema,
    execute: async () => {
      if (!ctx.session.reservationId) {
        return {
          released: false,
          reason: 'There is no active seat hold in this session.',
        };
      }

      try {
        await ctx.reservation.cancel(ctx.session.reservationId);
        ctx.session.reservationId = null;
        return { released: true };
      } catch (error) {
        if (
          error instanceof NotFoundException ||
          error instanceof ConflictException
        ) {
          ctx.session.reservationId = null;
          return {
            released: false,
            reason: error.message,
          };
        }

        throw error;
      }
    },
  };
}
