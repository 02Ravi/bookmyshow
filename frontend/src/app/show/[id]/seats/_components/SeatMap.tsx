'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShowSocket } from '@/hooks/useShowSocket';
import { extractApiError } from '@/lib/api';
import { fetchShowSeats, type ShowSeat } from '@/lib/booking-api';
import { useCartStore } from '@/stores/cartStore';
import { CheckoutSheet } from './CheckoutSheet';

interface SeatMapProps {
  showId: string;
}

const EMPTY_SET = new Set<string>();

function groupSeatsByRow(seats: ShowSeat[]): Map<string, ShowSeat[]> {
  const rows = new Map<string, ShowSeat[]>();
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

export function SeatMap({ showId }: SeatMapProps) {
  useShowSocket(showId);

  const cartShowId = useCartStore((s) => s.showId);
  const cartSelectedIds = useCartStore((s) => s.selectedIds);
  const toggleSeatInCart = useCartStore((s) => s.toggleSeat);
  const removeSeats = useCartStore((s) => s.removeSeats);
  const clearCart = useCartStore((s) => s.clearCart);

  const selectedIds = useMemo(() => {
    if (cartShowId !== showId) return EMPTY_SET;
    return new Set(cartSelectedIds);
  }, [cartShowId, showId, cartSelectedIds]);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeHeldSeatLabels, setActiveHeldSeatLabels] = useState<
    string[]
  >([]);
  const [holdExpiredMessage, setHoldExpiredMessage] = useState<string | null>(
    null,
  );

  const { data: seats = [], isLoading, error } = useQuery({
    queryKey: ['show-seats', showId],
    queryFn: () => fetchShowSeats(showId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const rows = useMemo(() => groupSeatsByRow(seats), [seats]);

  const selectedSeats = useMemo(
    () => seats.filter((s) => selectedIds.has(s.seatLabel)),
    [seats, selectedIds],
  );

  const total = useMemo(
    () => selectedSeats.reduce((sum, s) => sum + Number(s.price), 0),
    [selectedSeats],
  );

  const activeHeldSeatLabelSet = useMemo(
    () => new Set(activeHeldSeatLabels),
    [activeHeldSeatLabels],
  );

  useEffect(() => {
    if (cartShowId !== showId || seats.length === 0) return;
    const takenIds = cartSelectedIds.filter((id) => {
      const seat = seats.find((s) => s.seatLabel === id);
      if (!seat || seat.status === 'AVAILABLE') return false;
      if (
        seat.status === 'HELD' &&
        activeHeldSeatLabelSet.has(seat.seatLabel)
      ) {
        return false;
      }
      return true;
    });
    if (takenIds.length > 0) removeSeats(showId, takenIds);
  }, [
    seats,
    cartShowId,
    showId,
    cartSelectedIds,
    removeSeats,
    activeHeldSeatLabelSet,
  ]);

  const toggleSeat = useCallback(
    (seat: ShowSeat) => {
      if (seat.status !== 'AVAILABLE') return;
      toggleSeatInCart(showId, seat.seatLabel);
    },
    [showId, toggleSeatInCart],
  );

  function seatClassName(seat: ShowSeat): string {
    if (seat.status === 'BOOKED' || seat.status === 'HELD') {
      return 'bms-seat bms-seat-sold';
    }
    if (selectedIds.has(seat.seatLabel)) {
      return 'bms-seat bms-seat-selected';
    }
    return 'bms-seat bms-seat-available';
  }

  function handleCheckoutClose() {
    setCheckoutOpen(false);
    setActiveHeldSeatLabels([]);
  }

  function handleSeatsUnavailable() {
    clearCart();
    setCheckoutOpen(false);
    setActiveHeldSeatLabels([]);
  }

  function handleHoldExpired() {
    setHoldExpiredMessage(
      'Your seat hold expired, please select seats again.',
    );
    clearCart();
    setActiveHeldSeatLabels([]);
  }

  function handleProceed() {
    setHoldExpiredMessage(null);
    setCheckoutOpen(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-[var(--bms-text-muted)]">Loading seat layout...</p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-red-600">
        {extractApiError(error, 'Failed to load seats. Please try again.')}
      </p>
    );
  }

  return (
    <>
      <div className="pb-28">
        {holdExpiredMessage && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {holdExpiredMessage}
          </div>
        )}

        <div className="mb-2 text-center text-xs font-medium uppercase tracking-widest text-gray-400">
          Screen this way
        </div>
        <div className="bms-screen-curve" />

        <div className="mb-6 flex flex-wrap justify-center gap-4 text-xs text-[var(--bms-text-muted)]">
          <span className="flex items-center gap-2">
            <span className="bms-seat bms-seat-available h-4 w-4" />
            Available
          </span>
          <span className="flex items-center gap-2">
            <span className="bms-seat bms-seat-selected h-4 w-4" />
            Selected
          </span>
          <span className="flex items-center gap-2">
            <span className="bms-seat bms-seat-sold h-4 w-4" />
            Sold
          </span>
        </div>

        <div className="flex flex-col items-center gap-2">
          {[...rows.entries()].map(([row, rowSeats]) => (
            <div key={row} className="flex items-center gap-2">
              <span className="w-5 text-center text-xs font-semibold text-gray-500">
                {row}
              </span>
              <div className="flex gap-1">
                {rowSeats.map((seat) => (
                  <button
                    key={seat.seatLabel}
                    type="button"
                    className={seatClassName(seat)}
                    disabled={seat.status !== 'AVAILABLE'}
                    onClick={() => toggleSeat(seat)}
                    title={`${seat.row}${seat.number} - ₹${seat.price}`}
                  >
                    {seat.number}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--bms-border)] bg-white px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--bms-text)]">
              {selectedIds.size === 0
                ? 'No seats selected'
                : `${selectedIds.size} seat${selectedIds.size !== 1 ? 's' : ''}`}
            </p>
            {selectedIds.size > 0 && (
              <p className="text-lg font-bold text-[var(--bms-red)]">
                ₹{total.toFixed(2)}
              </p>
            )}
          </div>
          <button
            type="button"
            className="bms-cta min-w-[140px]"
            disabled={selectedIds.size === 0 || checkoutOpen}
            onClick={handleProceed}
          >
            Proceed
          </button>
        </div>
      </div>

      {checkoutOpen && selectedSeats.length > 0 && (
        <CheckoutSheet
          showId={showId}
          selectedSeats={selectedSeats}
          total={total}
          onClose={handleCheckoutClose}
          onSeatsUnavailable={handleSeatsUnavailable}
          onHoldHeld={setActiveHeldSeatLabels}
          onHoldExpired={handleHoldExpired}
        />
      )}
    </>
  );
}
