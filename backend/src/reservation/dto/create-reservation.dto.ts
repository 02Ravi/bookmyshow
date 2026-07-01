import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  HOLD_TTL_MAX_SECONDS,
  HOLD_TTL_MIN_SECONDS,
} from '../../common/constants';

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
  @Min(HOLD_TTL_MIN_SECONDS)
  @Max(HOLD_TTL_MAX_SECONDS)
  holdDurationSeconds?: number;
}
