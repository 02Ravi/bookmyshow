export function seatHoldKey(showSeatId: string): string {
  return `hold:showSeat:${showSeatId}`;
}

export function agentSessionKey(sessionId: string): string {
  return `agent:session:${sessionId}`;
}

export function agentLockKey(sessionId: string): string {
  return `agent:lock:${sessionId}`;
}

export function showRoomKey(showId: string): string {
  return `show:${showId}`;
}
