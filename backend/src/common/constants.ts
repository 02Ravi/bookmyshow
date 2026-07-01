/** Default seat hold duration, in seconds (10 minutes). */
export const HOLD_TTL_SECONDS = 600;
/** Minimum allowed hold duration accepted by reservation endpoints/tools. */
export const HOLD_TTL_MIN_SECONDS = 5;
/** Maximum allowed hold duration accepted by reservation endpoints/tools. */
export const HOLD_TTL_MAX_SECONDS = 600;
/** Shortened hold duration used when DEMO_FAST_HOLD=true, for demos. */
export const DEMO_FAST_HOLD_SECONDS = 10;

/** Agent session Redis TTL, in seconds (30 minutes). */
export const AGENT_SESSION_TTL_SECONDS = 1800;
/** Agent per-turn Redis lock TTL, in seconds. */
export const AGENT_TURN_LOCK_TTL_SECONDS = 30;
/** Max tool-call steps the agent loop is allowed per turn. */
export const AGENT_LOOP_MAX_STEPS = 2;

/** Max reservations reconciled per cron tick. */
export const RECONCILE_BATCH_SIZE = 100;

/** Max ticket cards rendered at once for a "view my bookings" response. */
export const MAX_TICKETS_SHOWN = 5;
