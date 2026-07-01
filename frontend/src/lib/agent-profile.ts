export const PROFILE_MESSAGE_PREFIX = 'PROFILE:';

export interface AgentProfilePayload {
  name: string;
  email: string;
  phone: string;
}

export function serializeProfileMessage(profile: AgentProfilePayload): string {
  return `${PROFILE_MESSAGE_PREFIX}${JSON.stringify(profile)}`;
}
