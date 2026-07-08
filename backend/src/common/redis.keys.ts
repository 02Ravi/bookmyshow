export function agentSessionKey(sessionId: string): string {
  return `agent:session:${sessionId}`;
}

export function agentLockKey(sessionId: string): string {
  return `agent:lock:${sessionId}`;
}

export function showRoomKey(showId: string): string {
  return `show:${showId}`;
}

/** Redis sorted set of active seat holds for a show (member=seatLabel, score=expiryMs). */
export function showHoldsKey(showId: string): string {
  return `show:${showId}:holds`;
}

/** Redis hash backing a hold token (ownership + seat list for confirm). */
export function holdTokenKey(token: string): string {
  return `hold:token:${token}`;
}
