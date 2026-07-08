import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CreateHoldDto } from '../dto/create-hold.dto';
import { HoldResponseDto } from '../dto/hold-response.dto';
import { HoldService } from '../service/hold.service';

@Controller('holds')
export class HoldController {
  constructor(private readonly holdService: HoldService) {}

  @Post()
  async create(@Body() dto: CreateHoldDto): Promise<HoldResponseDto> {
    const hold = await this.holdService.createHold(dto);
    return {
      token: hold.token,
      showId: hold.showId,
      seatLabels: hold.seatLabels,
      expiresAt: hold.expiresAt.toISOString(),
      userId: hold.userId,
    };
  }

  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async release(@Param('token') token: string): Promise<void> {
    await this.holdService.releaseHold(token);
  }
}
