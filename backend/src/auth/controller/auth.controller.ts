import { Body, Controller, Post } from '@nestjs/common';
import { UpsertUserDto } from '../dto/upsert-user.dto';
import { AuthService } from '../service/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('upsert')
  upsert(@Body() dto: UpsertUserDto) {
    return this.authService.upsert(dto);
  }
}
