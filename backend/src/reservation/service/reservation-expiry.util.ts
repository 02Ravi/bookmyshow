export function isReservationExpired(reservation: {
  expiresAt: Date;
}): boolean {
  return reservation.expiresAt.getTime() <= Date.now();
}

/** Whole seconds remaining until expiry; never negative. */
export function getSecondsUntilExpiry(reservation: {
  expiresAt: Date;
}): number {
  return Math.max(
    0,
    Math.floor((reservation.expiresAt.getTime() - Date.now()) / 1000),
  );
}
