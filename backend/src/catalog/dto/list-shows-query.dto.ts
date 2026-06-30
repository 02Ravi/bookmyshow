import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ListShowsQueryDto {
  @IsOptional()
  @IsUUID()
  movieId?: string;

  @IsOptional()
  @IsUUID()
  theatreId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
