import type { BookingToolsContext } from './context.js';
import { createCancelBookingTool } from './cancelBooking.js';
import { createConfirmBookingTool } from './confirmBooking.js';
import { createGetBookingTool } from './getBooking.js';
import { createGetSeatMapTool } from './getSeatMap.js';
import { createHoldSeatsTool } from './holdSeats.js';
import { createListBookingsTool } from './listBookings.js';
import { createListMoviesTool } from './listMovies.js';
import { createListShowsTool } from './listShows.js';
import { createReleaseHoldTool } from './releaseHold.js';
import { serializeToolResult } from './serializeToolResult.js';
import { createUiMarkdownTool } from './uiMarkdown.js';
import { createUiPromptTool } from './uiPrompt.js';
import { createUpsertUserTool } from './upsertUser.js';

export type { BookingToolsContext } from './context.js';

type ExecutableTool = {
  execute?: (...args: never[]) => unknown | Promise<unknown>;
};

function withSerializableResult<T extends ExecutableTool>(tool: T): T {
  if (!tool.execute) {
    return tool;
  }

  const execute = tool.execute.bind(tool);

  return {
    ...tool,
    execute: async (...args: never[]) =>
      serializeToolResult(await execute(...args)),
  };
}

export function createBookingTools(ctx: BookingToolsContext) {
  return {
    listMovies: withSerializableResult(createListMoviesTool(ctx)),
    listShows: withSerializableResult(createListShowsTool(ctx)),
    getSeatMap: withSerializableResult(createGetSeatMapTool(ctx)),
    upsertUser: withSerializableResult(createUpsertUserTool(ctx)),
    holdSeats: withSerializableResult(createHoldSeatsTool(ctx)),
    confirmBooking: withSerializableResult(createConfirmBookingTool(ctx)),
    cancelBooking: withSerializableResult(createCancelBookingTool(ctx)),
    releaseHold: withSerializableResult(createReleaseHoldTool(ctx)),
    listBookings: withSerializableResult(createListBookingsTool(ctx)),
    getBooking: withSerializableResult(createGetBookingTool(ctx)),
    uiMarkdown: createUiMarkdownTool(),
    uiPrompt: createUiPromptTool(),
  };
}
