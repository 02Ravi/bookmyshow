import type { ModelMessage } from 'ai';
import { AGENT_LOOP_MAX_STEPS } from '../../common/constants';
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
    stopWhen: isStepCount(AGENT_LOOP_MAX_STEPS),
  });

  return {
    text: result.text,
    toolCalls: result.toolCalls,
    steps: result.steps,
  };
}
