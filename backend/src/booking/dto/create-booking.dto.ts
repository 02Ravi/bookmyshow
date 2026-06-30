import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  reservationId!: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
