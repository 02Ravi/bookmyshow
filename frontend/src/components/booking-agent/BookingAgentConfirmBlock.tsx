'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ChoiceOption } from '@/types/agent';

interface BookingAgentConfirmBlockProps {
  choices?: ChoiceOption[];
  disabled?: boolean;
  message: string;
  onConfirm: (value: string) => void | Promise<void>;
}

export function BookingAgentConfirmBlock({
  choices,
  disabled = false,
  message,
  onConfirm,
}: BookingAgentConfirmBlockProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedLabel, setSubmittedLabel] = useState('');

  const confirmChoices =
    choices && choices.length > 0
      ? choices
      : [
          { label: 'Confirm', value: 'confirm' },
          { label: 'Cancel', value: 'cancel' },
        ];

  async function handleChoice(value: string, label: string) {
    if (disabled || isSubmitted) return;
    setIsSubmitted(true);
    setSubmittedLabel(label);
    await onConfirm(value);
  }

  if (isSubmitted) {
    return (
      <div className="bms-agent-card">
        <p className="text-sm text-[var(--bms-text-muted)]">You chose: {submittedLabel}</p>
      </div>
    );
  }

  return (
    <div className="bms-agent-card">
      <p className="bms-agent-card-label mb-2">Confirm</p>
      <p className="text-sm font-medium text-[var(--bms-text)]">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {confirmChoices.map((choice) => (
          <button
            key={`${choice.label}-${choice.value}`}
            type="button"
            disabled={disabled}
            onClick={() => void handleChoice(choice.value, choice.label)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-60',
              choice.value === 'confirm'
                ? 'border-[var(--bms-red)] bg-[var(--bms-red)] text-white hover:bg-[var(--bms-red-hover)]'
                : 'border-[var(--bms-chat-border)] bg-[var(--bms-chat-muted)] text-[var(--bms-text)] hover:bg-white',
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}
