import { z } from 'zod';

const choice = z.object({
  label: z.string(),
  value: z.string(),
  description: z.string().optional(),
});

export function createUiPromptTool() {
  const seat = z.object({
    showSeatId: z.string().uuid(),
    row: z.string(),
    number: z.number(),
    type: z.string(),
    status: z.enum(['AVAILABLE', 'HELD', 'BOOKED']),
    price: z.number(),
  });

  const inputSchema = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('choice_group'),
      message: z.string(),
      mode: z.enum(['single', 'multi']).optional(),
      presentation: z
        .enum(['dropdown', 'radio', 'checkbox', 'chips'])
        .optional(),
      choices: z.array(choice).min(1),
    }),
    z.object({
      type: z.literal('confirm'),
      message: z.string(),
      choices: z.array(choice).optional(),
    }),
    z.object({
      type: z.literal('seat_picker'),
      message: z.string(),
      seats: z.array(seat),
      maxSelections: z.number().optional(),
    }),
  ]);

  return {
    description:
      'Render structured UI prompts in the booking chat. Use choice_group with presentation dropdown and mode single for movie or show selection (choices value must be UUIDs from prior tool results). After movie selection, use choice_group with presentation chips for available show dates (choices value = YYYY-MM-DD). Use seat_picker after getSeatMap. Never ask the user to type titles or ids.',
    inputSchema,
    execute: async (input: z.infer<typeof inputSchema>) => input,
  };
}
