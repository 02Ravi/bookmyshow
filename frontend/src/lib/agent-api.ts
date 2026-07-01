import { api } from './api';

export interface AgentToolCall {
  toolName: string;
  input?: unknown;
}

export interface AgentChatApiResponse {
  text: string;
  toolCalls: AgentToolCall[];
  sessionId: string;
  redirectTo?: string;
}

export interface AgentIdentityPayload {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export async function sendAgentMessage(
  message: string,
  sessionId?: string,
  identity?: AgentIdentityPayload,
): Promise<AgentChatApiResponse> {
  const { data } = await api.post<AgentChatApiResponse>('/agent/chat', {
    message,
    sessionId,
    identity,
  });

  return data;
}
