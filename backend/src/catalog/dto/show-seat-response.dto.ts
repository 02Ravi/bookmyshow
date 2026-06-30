import { SeatType, ShowSeatStatus } from '../../generated/prisma/client';

export interface ShowSeatResponseDto {
  showSeatId: string;
  seatId: string;
  row: string;
  number: number;
  type: SeatType;
  status: ShowSeatStatus;
  price: string;
}

export function toShowSeatResponse(showSeat: {
  id: string;
  seatId: string;
  status: ShowSeatStatus;
  price: { toString(): string };
  seat: { row: string; number: number; type: SeatType };
}): ShowSeatResponseDto {
  return {
    showSeatId: showSeat.id,
    seatId: showSeat.seatId,
    row: showSeat.seat.row,
    number: showSeat.seat.number,
    type: showSeat.seat.type,
    status: showSeat.status,
    price: showSeat.price.toString(),
  };
}
