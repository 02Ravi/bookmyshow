'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SeatStatus } from '@/types/status';

interface SeatPickerSeat {
  showSeatId: string;
  row: string;
  number: number;
  type: string;
  status: SeatStatus;
  price: number;
}

interface BookingAgentSeatPickerProps {
  disabled?: boolean;
  maxSelections: number;
  message: string;
  onConfirm: (payload: string) => void | Promise<void>;
  seats: SeatPickerSeat[];
}

function groupSeatsByRow(seats: SeatPickerSeat[]): Map<string, SeatPickerSeat[]> {
  const rows = new Map<string, SeatPickerSeat[]>();

  for (const seat of seats) {
    const rowSeats = rows.get(seat.row) ?? [];
    rowSeats.push(seat);
    rows.set(seat.row, rowSeats);
  }

  for (const [, rowSeats] of rows) {
    rowSeats.sort((a, b) => a.number - b.number);
  }

  return new Map([...rows.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function rowHeader(rowSeats: SeatPickerSeat[]): string {
  const premiumSeat = rowSeats.find((seat) => seat.type === 'PREMIUM');
  if (premiumSeat) {
    return `Premium ₹${premiumSeat.price}`;
  }

  const regularSeat = rowSeats[0];
  return `${regularSeat?.type ?? 'Regular'} ₹${regularSeat?.price ?? 0}`;
}

export function BookingAgentSeatPicker({
  disabled = false,
  maxSelections,
  message,
  onConfirm,
  seats,
}: BookingAgentSeatPickerProps) {
  const rows = useMemo(() => groupSeatsByRow(seats), [seats]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const canConfirm =
    selectedIds.length > 0 &&
    (maxSelections > 0 ? selectedIds.length === maxSelections : true);

  const selectedSeats = seats.filter((seat) => selectedIds.includes(seat.showSeatId));

  function toggleSeat(showSeatId: string) {
    if (disabled || isSubmitted) return;

    setSelectedIds((current) => {
      if (current.includes(showSeatId)) {
        return current.filter((id) => id !== showSeatId);
      }

      if (maxSelections > 0 && current.length >= maxSelections) {
        return current;
      }

      return [...current, showSeatId];
    });
  }

  async function confirmSelection() {
    if (!canConfirm || disabled || isSubmitted) return;
    setIsSubmitted(true);
    await onConfirm(JSON.stringify(selectedIds));
  }

  function seatClassName(seat: SeatPickerSeat): string {
    if (seat.status !== 'AVAILABLE') {
      return 'bms-seat bms-seat-sold opacity-70';
    }
    if (selectedIds.includes(seat.showSeatId)) {
      return 'bms-seat bms-seat-selected ring-2 ring-green-400';
    }
    return 'bms-seat bms-seat-available';
  }

  return (
    <div className="bms-agent-card">
      <p className="bms-agent-card-label mb-2">Select seats</p>
      <p className="text-sm font-medium text-[var(--bms-text)]">{message}</p>

      <div className="mt-3 space-y-3">
        {[...rows.entries()].map(([row, rowSeats]) => (
          <div key={row}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--bms-text)]">Row {row}</span>
              <span className="text-xs text-[var(--bms-text-muted)]">{rowHeader(rowSeats)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {rowSeats.map((seat) => (
                <button
                  key={seat.showSeatId}
                  type="button"
                  disabled={disabled || isSubmitted || seat.status !== 'AVAILABLE'}
                  onClick={() => toggleSeat(seat.showSeatId)}
                  className={seatClassName(seat)}
                  title={`${seat.row}${seat.number} - ₹${seat.price}`}
                >
                  {seat.number}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isSubmitted ? (
        <div className="mt-4 rounded-md bg-[var(--bms-chat-muted)] px-3 py-2 text-sm text-[var(--bms-text-muted)]">
          You selected:{' '}
          {selectedSeats
            .map((seat) => `${seat.row}${seat.number} (${seat.type} ₹${seat.price})`)
            .join(', ')}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-[var(--bms-text-muted)]">
            {maxSelections > 0
              ? `Select ${maxSelections} seat${maxSelections !== 1 ? 's' : ''}.`
              : 'Select one or more seats.'}
          </p>
          <button
            type="button"
            disabled={!canConfirm || disabled}
            onClick={() => void confirmSelection()}
            className={cn('bms-cta', !canConfirm && 'opacity-50')}
          >
            {selectedIds.length > 0
              ? `Confirm ${selectedIds.length} seat${selectedIds.length !== 1 ? 's' : ''}`
              : 'Confirm selection'}
          </button>
        </div>
      )}
    </div>
  );
}
