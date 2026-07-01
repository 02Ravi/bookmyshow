'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ChoiceOption } from '@/types/agent';

interface BookingAgentChoiceGroupProps {
  choices: ChoiceOption[];
  disabled?: boolean;
  message: string;
  mode: 'single' | 'multi';
  onConfirm: (payload: string) => void | Promise<void>;
  presentation: 'dropdown' | 'radio' | 'checkbox' | 'chips';
}

export function BookingAgentChoiceGroup({
  choices,
  disabled = false,
  message,
  mode,
  onConfirm,
  presentation,
}: BookingAgentChoiceGroupProps) {
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const canConfirm = useMemo(() => {
    if (mode === 'multi') {
      return selectedValues.length > 0;
    }
    return selectedValues.length === 1;
  }, [mode, selectedValues]);

  const selectedLabels = choices
    .filter((choice) => selectedValues.includes(choice.value))
    .map((choice) => choice.label);

  function toggleValue(value: string) {
    if (disabled || isSubmitted) return;

    setSelectedValues((current) => {
      if (mode === 'multi') {
        return current.includes(value)
          ? current.filter((id) => id !== value)
          : [...current, value];
      }
      return current[0] === value ? [] : [value];
    });
  }

  async function confirmSelection() {
    if (!canConfirm || disabled || isSubmitted) return;
    setIsSubmitted(true);

    if (mode === 'multi') {
      await onConfirm(JSON.stringify(selectedValues));
      return;
    }

    await onConfirm(selectedValues[0]);
  }

  if (isSubmitted) {
    return (
      <div className="bms-agent-card">
        <p className="text-sm text-[var(--bms-text-muted)]">
          You selected: {selectedLabels.join(', ') || 'your choice'}
        </p>
      </div>
    );
  }

  return (
    <div className="bms-agent-card">
      <p className="bms-agent-card-label mb-2">Choose an option</p>
      <p className="text-sm font-medium text-[var(--bms-text)]">{message}</p>

      {presentation === 'dropdown' && mode === 'single' ? (
        <div className="mt-3">
          <select
            value={selectedValues[0] ?? ''}
            disabled={disabled}
            onChange={(event) =>
              setSelectedValues(event.target.value ? [event.target.value] : [])
            }
            className="w-full rounded-md border border-[var(--bms-chat-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--bms-red)] focus:ring-1 focus:ring-[var(--bms-red)]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Select an option…</option>
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {presentation === 'radio' && mode === 'single' ? (
        <ul className="mt-3 space-y-2">
          {choices.map((choice) => (
            <li key={choice.value}>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--bms-text)]">
                <input
                  type="radio"
                  name="booking-agent-choice"
                  disabled={disabled}
                  checked={selectedValues[0] === choice.value}
                  onChange={() => toggleValue(choice.value)}
                  className="mt-0.5 accent-[var(--bms-red)]"
                />
                <span>
                  {choice.label}
                  {choice.description ? (
                    <span className="block text-xs text-[var(--bms-text-muted)]">
                      {choice.description}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}

      {presentation === 'checkbox' || (presentation === 'chips' && mode === 'multi') ? (
        <ul className="mt-3 space-y-2">
          {choices.map((choice) => (
            <li key={choice.value}>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--bms-text)]">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selectedValues.includes(choice.value)}
                  onChange={() => toggleValue(choice.value)}
                  className="mt-0.5 accent-[var(--bms-red)]"
                />
                <span>
                  {choice.label}
                  {choice.description ? (
                    <span className="block text-xs text-[var(--bms-text-muted)]">
                      {choice.description}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}

      {presentation === 'chips' && mode === 'single' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              disabled={disabled}
              onClick={() => toggleValue(choice.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-60',
                selectedValues.includes(choice.value)
                  ? 'border-[var(--bms-red)] bg-[var(--bms-red)] text-white'
                  : 'border-[var(--bms-chat-border)] bg-[var(--bms-chat-muted)] text-[var(--bms-text)] hover:bg-white',
              )}
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <button
          type="button"
          disabled={!canConfirm || disabled}
          onClick={() => void confirmSelection()}
          className="bms-cta"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
