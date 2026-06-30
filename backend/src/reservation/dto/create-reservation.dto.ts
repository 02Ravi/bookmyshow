import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  showId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  showSeatIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  holdDurationSeconds?: number;
}
