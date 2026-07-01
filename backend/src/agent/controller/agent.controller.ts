import { Body, Controller, Post } from '@nestjs/common';
import { AgentChatDto } from '../dto/agent-chat.dto';
import {
  AgentChatResponse,
  AgentChatService,
} from '../service/agent-chat.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentChatService: AgentChatService) {}

  @Post('chat')
  async chat(@Body() dto: AgentChatDto): Promise<AgentChatResponse> {
    return this.agentChatService.handleChat(dto);
  }
}
