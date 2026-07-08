export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';

export interface ShowSeatResponseDto {
  seatLabel: string;
  row: string;
  number: number;
  type: string;
  status: SeatStatus;
  price: string;
}
