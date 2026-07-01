import { z } from 'zod';
import type { BookingToolsContext } from './context';

export function createUpsertUserTool(ctx: BookingToolsContext) {
  const inputSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  });

  return {
    description:
      'Create or update a user profile so booking actions can be tied to a user.',
    inputSchema,
    execute: async ({ name, email, phone }: z.infer<typeof inputSchema>) => {
      const user = await ctx.auth.upsert({ name, email, phone });
      ctx.session.userId = user.id;

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
      };
    },
  };
}
