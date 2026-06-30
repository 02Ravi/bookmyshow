'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { fetchBookingsByUser } from '@/lib/booking-api';
import { useAuthStore } from '@/stores/authStore';

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

function statusBadgeClass(status: string): string {
  if (status === 'CONFIRMED') {
    return 'bg-green-100 text-green-700';
  }
  if (status === 'CANCELLED') {
    return 'bg-red-100 text-red-700';
  }
  return 'bg-gray-100 text-gray-700';
}

export function BookingsContent() {
  const searchParams = useSearchParams();
  const authUserId = useAuthStore((s) => s.userId);
  const userId = authUserId ?? searchParams.get('userId');

  const { data: bookings = [], isLoading, error } = useQuery({
    queryKey: ['bookings', userId],
    queryFn: () => fetchBookingsByUser(userId!),
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-4 text-2xl font-bold text-[var(--bms-text)]">
          My Bookings
        </h1>
        <div className="bms-card p-8 text-center">
          <p className="text-[var(--bms-text-muted)]">
            No bookings found on this device.
          </p>
          <p className="mt-2 text-sm text-[var(--bms-text-muted)]">
            Book a movie and your tickets will appear here automatically.
          </p>
          <Link href="/" className="bms-cta mt-6 inline-block">
            Browse movies
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold text-[var(--bms-text)]">
        My Bookings
      </h1>

      {isLoading && (
        <p className="text-[var(--bms-text-muted)]">Loading bookings...</p>
      )}

      {error && <p className="text-red-600">Failed to load bookings.</p>}

      {!isLoading && bookings.length === 0 && (
        <div className="bms-card p-8 text-center">
          <p className="text-[var(--bms-text-muted)]">No bookings yet.</p>
          <Link href="/" className="bms-cta mt-6 inline-block">
            Browse movies
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/booking/${booking.id}`}
            className="bms-card block p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-[var(--bms-text)]">
                  {booking.show.movie.title}
                </h2>
                <p className="mt-1 text-sm text-[var(--bms-text-muted)]">
                  {formatDateTime(booking.show.startTime)}
                </p>
                <p className="text-sm text-[var(--bms-text-muted)]">
                  {booking.show.theatre.name}, {booking.show.theatre.city}
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--bms-red)]">
                  {booking.seatCount} seat{booking.seatCount !== 1 ? 's' : ''}
                </p>
              </div>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(booking.status)}`}
              >
                {booking.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
