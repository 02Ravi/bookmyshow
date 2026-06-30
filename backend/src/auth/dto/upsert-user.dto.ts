import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
