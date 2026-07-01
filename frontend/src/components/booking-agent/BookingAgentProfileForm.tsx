'use client';

import { FormEvent, useEffect, useState } from 'react';
import { serializeProfileMessage } from '@/lib/agent-profile';
import { useAuthStore } from '@/stores/authStore';

interface BookingAgentProfileFormProps {
  disabled?: boolean;
  message: string;
  onConfirm: (payload: string, displayContent: string) => void | Promise<void>;
}

export function BookingAgentProfileForm({
  disabled = false,
  message,
  onConfirm,
}: BookingAgentProfileFormProps) {
  const profileName = useAuthStore((s) => s.name);
  const profileEmail = useAuthStore((s) => s.email);
  const profilePhone = useAuthStore((s) => s.phone);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    setName(profileName ?? '');
    setEmail(profileEmail ?? '');
    setPhone(profilePhone ?? '');
  }, [profileName, profileEmail, profilePhone]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (disabled || isSubmitted) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone) {
      setError('Name, email, and phone are required.');
      return;
    }

    setError(null);
    setIsSubmitted(true);

    const profile = {
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
    };

    await onConfirm(
      serializeProfileMessage(profile),
      `${trimmedName} · ${trimmedEmail}`,
    );
  }

  if (isSubmitted) {
    return (
      <div className="bms-agent-card">
        <p className="text-sm text-[var(--bms-text-muted)]">
          Details saved for {name.trim()}
        </p>
      </div>
    );
  }

  return (
    <form className="bms-agent-card" onSubmit={(event) => void handleSubmit(event)}>
      <p className="bms-agent-card-label mb-2">Your details</p>
      <p className="text-sm font-medium text-[var(--bms-text)]">{message}</p>

      <div className="mt-3 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--bms-text-muted)]">Name</span>
          <input
            type="text"
            value={name}
            disabled={disabled}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-[var(--bms-chat-border)] px-3 py-2 text-sm outline-none focus:border-[var(--bms-red)]"
            placeholder="Full name"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--bms-text-muted)]">Email</span>
          <input
            type="email"
            value={email}
            disabled={disabled}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-[var(--bms-chat-border)] px-3 py-2 text-sm outline-none focus:border-[var(--bms-red)]"
            placeholder="you@example.com"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--bms-text-muted)]">Phone</span>
          <input
            type="tel"
            value={phone}
            disabled={disabled}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-md border border-[var(--bms-chat-border)] px-3 py-2 text-sm outline-none focus:border-[var(--bms-red)]"
            placeholder="10-digit mobile"
          />
        </label>
      </div>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <button type="submit" disabled={disabled} className="bms-cta mt-4">
        Continue
      </button>
    </form>
  );
}
