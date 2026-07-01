export function isReservationExpired(reservation: { expiresAt: Date }): boolean {
  return reservation.expiresAt.getTime() <= Date.now();
}
