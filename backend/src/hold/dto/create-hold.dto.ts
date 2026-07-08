import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  HOLD_TTL_MAX_SECONDS,
  HOLD_TTL_MIN_SECONDS,
} from '../../common/constants';

export class CreateHoldDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  showId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  seatLabels!: string[];

  @IsOptional()
  @IsInt()
  @Min(HOLD_TTL_MIN_SECONDS)
  @Max(HOLD_TTL_MAX_SECONDS)
  holdDurationSeconds?: number;
}
