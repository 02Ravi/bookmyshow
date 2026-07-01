import { AuthService } from '../../auth/service/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentSession } from './session.service';

export interface SessionIdentityPayload {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface ClientIdentityInput {
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export function toSessionIdentity(
  session: AgentSession,
): SessionIdentityPayload | undefined {
  if (!session.userId || !session.name || !session.email) {
    return undefined;
  }

  return {
    userId: session.userId,
    name: session.name,
    email: session.email,
    phone: session.phone,
  };
}

/** Prefer upsert by email so stale client userIds are replaced with a live DB row. */
export async function reconcileClientIdentity(
  session: AgentSession,
  identity: ClientIdentityInput | undefined,
  auth: AuthService,
  prisma: PrismaService,
): Promise<void> {
  if (identity?.email?.trim() && identity?.name?.trim()) {
    const user = await auth.upsert({
      name: identity.name.trim(),
      email: identity.email.trim(),
      phone: identity.phone?.trim() || undefined,
    });
    session.userId = user.id;
    session.name = user.name;
    session.email = user.email;
    session.phone = user.phone;
    return;
  }

  if (!identity?.userId) {
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: { id: true, name: true, email: true, phone: true },
  });

  if (!existing) {
    return;
  }

  if (!session.userId) {
    session.userId = existing.id;
    session.name = identity.name?.trim() || existing.name;
    session.email = identity.email?.trim() || existing.email;
    session.phone = identity.phone?.trim() || existing.phone;
  }
}

export async function upsertProfileIntoSession(
  session: AgentSession,
  profile: { name: string; email: string; phone?: string },
  auth: AuthService,
): Promise<void> {
  const user = await auth.upsert({
    name: profile.name.trim(),
    email: profile.email.trim(),
    phone: profile.phone?.trim() || undefined,
  });

  session.userId = user.id;
  session.name = user.name;
  session.email = user.email;
  session.phone = user.phone;
}
