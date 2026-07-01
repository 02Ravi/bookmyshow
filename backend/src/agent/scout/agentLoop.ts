import type { ModelMessage } from 'ai';
import type { BookingToolsContext } from '../tools';

async function loadAgentSdk() {
  const [{ generateText, isStepCount }, { google }, { createBookingTools }] =
    await Promise.all([
      import('ai'),
      import('@ai-sdk/google'),
      import('../tools/index.js'),
    ]);

  return { generateText, isStepCount, google, createBookingTools };
}

export async function runAgentLoop(params: {
  instructions: string;
  messages: ModelMessage[];
  ctx: BookingToolsContext;
}) {
  const { generateText, isStepCount, google, createBookingTools } =
    await loadAgentSdk();

  const result = await generateText({
    model: google('gemini-2.5-flash'),
    instructions: params.instructions,
    messages: params.messages,
    tools: createBookingTools(params.ctx),
    stopWhen: isStepCount(2),
  });

  return {
    text: result.text,
    toolCalls: result.toolCalls,
    steps: result.steps,
  };
}
