'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { use, useMemo } from 'react';
import { fetchBookingById } from '@/lib/booking-api';
import { useAuthStore } from '@/stores/authStore';

interface BookingPageProps {
  params: Promise<{ id: string }>;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BookingConfirmationPage({ params }: BookingPageProps) {
  const { id } = use(params);
  const userId = useAuthStore((s) => s.userId);
  const profileName = useAuthStore((s) => s.name);
  const profileEmail = useAuthStore((s) => s.email);
  const profilePhone = useAuthStore((s) => s.phone);

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => fetchBookingById(id),
  });

  const total = useMemo(() => {
    if (!booking) return 0;
    return booking.seats.reduce((sum, seat) => sum + Number(seat.price), 0);
  }, [booking]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-8">
        <p className="text-[var(--bms-text-muted)]">Loading booking...</p>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-8">
        <p className="text-red-600">Booking not found.</p>
        <Link href="/" className="mt-4 inline-block text-[var(--bms-red)]">
          Back to home
        </Link>
      </main>
    );
  }

  const bookingsHref = userId
    ? `/bookings?userId=${userId}`
    : `/bookings?userId=${booking.userId}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-[var(--bms-text)]">
          Booking Confirmed!
        </h1>
        <p className="mt-1 text-sm text-[var(--bms-text-muted)]">
          Your ticket has been booked successfully
        </p>
      </div>

      <div className="bms-ticket">
        <div className="bms-ticket-notch -left-3" />
        <div className="bms-ticket-notch -right-3" />

        <div className="flex gap-4 border-b border-dashed border-[var(--bms-border)] p-5">
          <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md bg-gray-100">
            <Image
              src={booking.show.movie.posterUrl}
              alt={booking.show.movie.title}
              fill
              unoptimized
              className="object-cover"
              sizes="80px"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[var(--bms-text)]">
              {booking.show.movie.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--bms-text-muted)]">
              {formatDateTime(booking.show.startTime)}
            </p>
            <p className="text-sm text-[var(--bms-text-muted)]">
              {booking.show.theatre.name}, {booking.show.theatre.city}
            </p>
            <span className="mt-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
              {booking.status}
            </span>
          </div>
        </div>

        <div className="border-b border-dashed border-[var(--bms-border)] p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--bms-text-muted)]">
            Seats
          </h3>
          <ul className="space-y-2">
            {booking.seats.map((seat) => (
              <li
                key={seat.seatLabel}
                className="flex justify-between text-sm text-[var(--bms-text)]"
              >
                <span>
                  Row {seat.row} · Seat {seat.number} · {seat.type}
                </span>
                <span className="font-medium">₹{seat.price}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-right text-xl font-bold text-[var(--bms-red)]">
            ₹{total.toFixed(2)}
          </p>
        </div>

        {(profileName || profileEmail || profilePhone) && (
          <div className="p-5">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--bms-text-muted)]">
              Contact
            </h3>
            {profileName && (
              <p className="text-sm text-[var(--bms-text)]">{profileName}</p>
            )}
            {profileEmail && (
              <p className="text-sm text-[var(--bms-text-muted)]">
                {profileEmail}
              </p>
            )}
            {profilePhone && (
              <p className="text-sm text-[var(--bms-text-muted)]">
                {profilePhone}
              </p>
            )}
          </div>
        )}

        <div className="bg-[var(--bms-page)] px-5 py-3 text-center">
          <p className="font-mono text-xs text-[var(--bms-text-muted)]">
            Booking ID: {booking.id}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href={bookingsHref} className="bms-cta text-center">
          View my bookings
        </Link>
        <Link
          href="/"
          className="rounded-md border border-[var(--bms-border)] bg-white px-6 py-2.5 text-center text-sm font-semibold text-[var(--bms-text)] transition hover:bg-gray-50"
        >
          Book more movies
        </Link>
      </div>
    </main>
  );
}
