import { z } from 'zod';

export function createUiMarkdownTool() {
  const inputSchema = z.object({
    markdown: z.string(),
  });

  return {
    description: 'Render rich markdown content in the booking chat UI.',
    inputSchema,
    execute: async ({ markdown }: z.infer<typeof inputSchema>) => ({ markdown }),
  };
}
