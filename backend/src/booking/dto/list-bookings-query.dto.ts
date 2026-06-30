import { IsUUID } from 'class-validator';

export class ListBookingsQueryDto {
  @IsUUID()
  userId!: string;
}
