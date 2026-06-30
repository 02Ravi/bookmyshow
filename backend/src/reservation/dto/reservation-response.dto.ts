import { ReservationStatus } from '../../generated/prisma/client';

export interface ReservationResponseDto {
  id: string;
  userId: string;
  status: ReservationStatus;
  expiresAt: Date;
  showId: string;
  showSeatIds: string[];
}
