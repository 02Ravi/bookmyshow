import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  holdToken!: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
