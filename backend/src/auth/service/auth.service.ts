import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertUserDto } from '../dto/upsert-user.dto';

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(dto: UpsertUserDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.upsert({
      where: { email: dto.email },
      create: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
      },
      update: {
        name: dto.name,
        phone: dto.phone ?? null,
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
    };
  }
}
