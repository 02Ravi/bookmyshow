'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelReservationSafe,
  createBooking,
  createReservation,
  type ShowSeat,
} from '@/lib/booking-api';
import { extractApiError, extractApiStatus } from '@/lib/api';
import { upsertUser } from '@/lib/movies-api';
import { useAuthStore } from '@/stores/authStore';

interface CheckoutSheetProps {
  showId: string;
  selectedSeats: ShowSeat[];
  total: number;
  onClose: () => void;
  onSeatsUnavailable?: () => void;
  onReservationHeld?: (seatIds: string[]) => void;
  onHoldExpired?: () => void;
}

function getDemoHoldDurationSeconds(): number | undefined {
  return process.env.NEXT_PUBLIC_DEMO_FAST_HOLD === 'true' ? 10 : undefined;
}

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const STATUS_MESSAGES: Partial<Record<number, string>> = {
  409: 'One or more seats you selected have already been booked. Please go back and choose different seats.',
  410: 'Your reservation has expired. Please select seats again.',
};

export function CheckoutSheet({
  showId,
  selectedSeats,
  total,
  onClose,
  onSeatsUnavailable,
  onReservationHeld,
  onHoldExpired,
}: CheckoutSheetProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profileName = useAuthStore((s) => s.name);
  const profileEmail = useAuthStore((s) => s.email);
  const profilePhone = useAuthStore((s) => s.phone);

  const [phase, setPhase] = useState<'contact' | 'paying'>('contact');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seatsUnavailableError, setSeatsUnavailableError] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const cancelledRef = useRef(false);
  const expiryHandledRef = useRef(false);
  const holdInFlightRef = useRef(false);
  const payInFlightRef = useRef(false);

  useEffect(() => {
    setName(profileName ?? '');
    setEmail(profileEmail ?? '');
    setPhone(profilePhone ?? '');
  }, [profileName, profileEmail, profilePhone]);

  const doCancel = useCallback(
    async (reason: 'close' | 'expired' = 'close') => {
      if (payInFlightRef.current) return;
      if (cancelledRef.current) return;
      if (!reservationId) {
        onClose();
        return;
      }

      cancelledRef.current = true;
      try {
        await cancelReservationSafe(reservationId);
      } catch {
        // Swallow errors for already cancelled or confirmed reservations
      }

      await queryClient.refetchQueries({ queryKey: ['show-seats', showId] });

      if (reason === 'expired' && !expiryHandledRef.current) {
        expiryHandledRef.current = true;
        onHoldExpired?.();
      }

      onClose();
    },
    [onClose, onHoldExpired, queryClient, reservationId, showId],
  );

  useEffect(() => {
    if (phase !== 'paying' || !expiresAt) return;

    const updateCountdown = () => {
      const secs = Math.floor(
        (new Date(expiresAt).getTime() - Date.now()) / 1000,
      );
      setSecondsLeft(secs);
      if (secs <= 0) {
        void doCancel('expired');
      }
    };

    updateCountdown();
    const tick = setInterval(updateCountdown, 1000);
    return () => clearInterval(tick);
  }, [phase, expiresAt, doCancel]);

  const holdMutation = useMutation({
    mutationFn: async () => {
      if (holdInFlightRef.current) {
        throw new Error('Reservation request already in progress');
      }
      holdInFlightRef.current = true;
      const user = await upsertUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      });

      const reservation = await createReservation({
        userId: user.id,
        showId,
        showSeatIds: selectedSeats.map((s) => s.showSeatId),
        holdDurationSeconds: getDemoHoldDurationSeconds(),
      });

      return { user, reservation };
    },
    onSuccess: ({ user, reservation }) => {
      holdInFlightRef.current = false;
      useAuthStore.setState({
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
      });
      setReservationId(reservation.id);
      setExpiresAt(reservation.expiresAt);
      setPhase('paying');
      setError(null);
      setSeatsUnavailableError(false);
      onReservationHeld?.(reservation.showSeatIds);
      void queryClient.refetchQueries({ queryKey: ['show-seats', showId] });
    },
    onError: (err) => {
      holdInFlightRef.current = false;
      const status = extractApiStatus(err);
      setError(extractApiError(err, STATUS_MESSAGES[status ?? 0] ?? 'Something went wrong. Please try again.'));
      void queryClient.refetchQueries({ queryKey: ['show-seats', showId] });
      if (status === 409 || status === 410) {
        setSeatsUnavailableError(true);
      }
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (payInFlightRef.current) {
        throw new Error('Payment request already in progress');
      }
      payInFlightRef.current = true;
      if (!reservationId) {
        throw new Error('No active reservation');
      }

      const booking = await createBooking({
        reservationId,
        idempotencyKey: idempotencyKeyRef.current,
      });

      return booking;
    },
    onSuccess: async (booking) => {
      cancelledRef.current = true;
      setRedirecting(true);
      setError(null);
      await queryClient.refetchQueries({ queryKey: ['show-seats', showId] });
      router.push(`/booking/${booking.id}`);
    },
    onError: (err) => {
      payInFlightRef.current = false;
      const status = extractApiStatus(err);
      setError(extractApiError(err, STATUS_MESSAGES[status ?? 0] ?? 'Something went wrong. Please try again.'));
      void queryClient.refetchQueries({ queryKey: ['show-seats', showId] });
      if (status === 409 || status === 410) {
        setSeatsUnavailableError(true);
      }
    },
  });

  function handleHoldSubmit(e: FormEvent) {
    e.preventDefault();
    if (holdInFlightRef.current) return;
    setError(null);
    setSeatsUnavailableError(false);

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError('Name, email, and phone are required.');
      return;
    }

    holdMutation.mutate();
  }

  function handlePaySubmit(e: FormEvent) {
    e.preventDefault();
    if (payInFlightRef.current) return;
    setError(null);
    setSeatsUnavailableError(false);
    payMutation.mutate();
  }

  function handleDismiss() {
    if (redirecting) return;
    if (phase === 'paying') {
      void doCancel('close');
      return;
    }
    onClose();
  }

  const isBusy =
    holdMutation.isPending || payMutation.isPending || redirecting;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div
        className="absolute inset-0"
        onClick={isBusy ? undefined : handleDismiss}
        aria-hidden="true"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--bms-border)] bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-[var(--bms-text)]">
            {phase === 'contact' ? 'Complete your booking' : 'Payment'}
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isBusy}
            className="text-2xl leading-none text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-4">
          {phase === 'paying' && expiresAt && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Seats held for{' '}
              <span className="font-semibold tabular-nums">
                {formatCountdown(secondsLeft)}
              </span>
            </div>
          )}

          <div className="mb-6 rounded-lg bg-[var(--bms-page)] p-4">
            <p className="mb-2 text-sm font-semibold text-[var(--bms-text)]">
              {selectedSeats.length} seat
              {selectedSeats.length !== 1 ? 's' : ''} selected
            </p>
            <ul className="mb-3 space-y-1 text-sm text-[var(--bms-text-muted)]">
              {selectedSeats.map((seat) => (
                <li key={seat.showSeatId}>
                  Row {seat.row} · Seat {seat.number} · {seat.type} · ₹
                  {seat.price}
                </li>
              ))}
            </ul>
            <p className="text-right text-lg font-bold text-[var(--bms-text)]">
              Total: ₹{total.toFixed(2)}
            </p>
          </div>

          {phase === 'contact' ? (
            <form onSubmit={handleHoldSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-[var(--bms-text-muted)]">
                Enter your contact details to hold these seats while you pay.
              </p>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isBusy}
                  className="rounded-md border border-[var(--bms-border)] px-3 py-2.5 font-normal outline-none focus:border-[var(--bms-red)] disabled:bg-gray-50"
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isBusy}
                  className="rounded-md border border-[var(--bms-border)] px-3 py-2.5 font-normal outline-none focus:border-[var(--bms-red)] disabled:bg-gray-50"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium">
                Phone
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isBusy}
                  className="rounded-md border border-[var(--bms-border)] px-3 py-2.5 font-normal outline-none focus:border-[var(--bms-red)] disabled:bg-gray-50"
                  placeholder="+91 98765 43210"
                  autoComplete="tel"
                />
              </label>

              {error && (
                <div className="flex flex-col gap-2">
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                  {seatsUnavailableError && (
                    <button
                      type="button"
                      onClick={() => onSeatsUnavailable?.()}
                      className="w-full rounded-md border border-[var(--bms-border)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--bms-text)] hover:bg-[var(--bms-page)]"
                    >
                      Select different seats
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="bms-cta w-full py-3 text-base"
              >
                {holdMutation.isPending ? 'Holding seats...' : 'Hold my seats'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePaySubmit} className="flex flex-col gap-4">
              <p className="text-sm text-[var(--bms-text-muted)]">
                Your seats are held. Complete payment before the timer runs out.
              </p>

              {error && (
                <div className="flex flex-col gap-2">
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                  {seatsUnavailableError && (
                    <button
                      type="button"
                      onClick={() => onSeatsUnavailable?.()}
                      className="w-full rounded-md border border-[var(--bms-border)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--bms-text)] hover:bg-[var(--bms-page)]"
                    >
                      Select different seats
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy || seatsUnavailableError || secondsLeft <= 0}
                className="bms-cta w-full py-3 text-base"
              >
                {redirecting
                  ? 'Booking confirmed, redirecting...'
                  : payMutation.isPending
                    ? 'Processing...'
                    : `Pay ₹${total.toFixed(2)}`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
