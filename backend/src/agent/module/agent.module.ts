import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/module/auth.module';
import { BookingModule } from '../../booking/module/booking.module';
import { CatalogModule } from '../../catalog/module/catalog.module';
import { HoldModule } from '../../hold/module/hold.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AgentController } from '../controller/agent.controller';
import { AgentChatService } from '../service/agent-chat.service';
import { SessionService } from '../session/session.service';

@Module({
  imports: [
    CatalogModule,
    HoldModule,
    BookingModule,
    AuthModule,
    PrismaModule,
  ],
  controllers: [AgentController],
  providers: [SessionService, AgentChatService],
})
export class AgentModule {}
