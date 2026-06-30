'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchShowById } from '@/lib/movies-api';
import { SeatMap } from './_components/SeatMap';

interface SeatMapPageClientProps {
  showId: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SeatMapPageClient({ showId }: SeatMapPageClientProps) {
  const { data: show, isLoading } = useQuery({
    queryKey: ['show', showId],
    queryFn: () => fetchShowById(showId),
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href={show ? `/movie/${show.movie.id}` : '/'}
        className="mb-4 inline-flex items-center text-sm text-[var(--bms-red)] hover:underline"
      >
        ← Back to shows
      </Link>

      {isLoading && (
        <p className="mb-6 text-[var(--bms-text-muted)]">Loading show...</p>
      )}

      {show && (
        <header className="bms-card mb-6 p-4">
          <h1 className="text-xl font-bold text-[var(--bms-text)]">
            {show.movie.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--bms-text-muted)]">
            {show.screen.theatre.name} · {show.screen.theatre.city}
          </p>
          <p className="text-sm text-[var(--bms-text-muted)]">
            {show.screen.name} · {formatDateTime(show.startTime)}
          </p>
        </header>
      )}

      <h2 className="mb-4 text-center text-lg font-semibold text-[var(--bms-text)]">
        Select your seats
      </h2>

      <SeatMap showId={showId} />
    </main>
  );
}
