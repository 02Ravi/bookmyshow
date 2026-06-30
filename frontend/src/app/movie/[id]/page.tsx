'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { use, useMemo } from 'react';
import { fetchMovieById, fetchShowsByMovie, type Show } from '@/lib/movies-api';

interface MoviePageProps {
  params: Promise<{ id: string }>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupShowsByTheatreAndDate(
  shows: Show[],
): Map<string, Map<string, Show[]>> {
  const grouped = new Map<string, Map<string, Show[]>>();

  for (const show of shows) {
    const theatre = show.theatreName;
    const dateKey = new Date(show.startTime).toISOString().slice(0, 10);

    if (!grouped.has(theatre)) {
      grouped.set(theatre, new Map());
    }
    const dateMap = grouped.get(theatre)!;
    const dateShows = dateMap.get(dateKey) ?? [];
    dateShows.push(show);
    dateMap.set(dateKey, dateShows);
  }

  for (const [, dateMap] of grouped) {
    for (const [dateKey, dateShows] of dateMap) {
      dateShows.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      dateMap.set(dateKey, dateShows);
    }
  }

  return grouped;
}

export default function MoviePage({ params }: MoviePageProps) {
  const { id } = use(params);

  const { data: movie, isLoading: movieLoading, error: movieError } = useQuery({
    queryKey: ['movie', id],
    queryFn: () => fetchMovieById(id),
  });

  const { data: shows = [], isLoading: showsLoading } = useQuery({
    queryKey: ['shows', id],
    queryFn: () => fetchShowsByMovie(id),
  });

  const groupedShows = useMemo(
    () => groupShowsByTheatreAndDate(shows),
    [shows],
  );

  if (movieLoading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-[var(--bms-text-muted)]">Loading movie...</p>
      </main>
    );
  }

  if (movieError || !movie) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-red-600">Movie not found.</p>
        <Link href="/" className="mt-4 inline-block text-[var(--bms-red)]">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main>
      <section className="bg-[var(--bms-header)] px-6 py-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row">
          <div className="relative mx-auto aspect-[2/3] w-44 shrink-0 overflow-hidden rounded-lg shadow-xl md:mx-0 md:w-52">
            <Image
              src={movie.posterUrl}
              alt={movie.title}
              fill
              unoptimized
              className="object-cover"
              sizes="208px"
            />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl font-bold md:text-4xl">{movie.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded bg-white/10 px-3 py-1 text-sm">
                {movie.genre}
              </span>
              <span className="rounded bg-white/10 px-3 py-1 text-sm">
                {movie.language}
              </span>
              <span className="rounded bg-white/10 px-3 py-1 text-sm">
                {movie.durationMinutes} min
              </span>
            </div>
            <p className="mt-4 text-gray-300">
              Book your tickets now. No sign-up required.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="mb-6 text-xl font-bold text-[var(--bms-text)]">
          Select a show
        </h2>

        {showsLoading && (
          <p className="text-[var(--bms-text-muted)]">Loading shows...</p>
        )}

        {shows.length === 0 && !showsLoading && (
          <p className="text-[var(--bms-text-muted)]">
            No shows available for this movie.
          </p>
        )}

        <div className="flex flex-col gap-6">
          {[...groupedShows.entries()].map(([theatreName, dateMap]) => (
            <div key={theatreName} className="bms-card p-5">
              <h3 className="mb-4 text-lg font-semibold text-[var(--bms-text)]">
                {theatreName}
              </h3>
              <div className="flex flex-col gap-4">
                {[...dateMap.entries()].map(([dateKey, dateShows]) => (
                  <div key={dateKey}>
                    <p className="mb-3 text-sm font-medium text-[var(--bms-text-muted)]">
                      {formatDate(dateShows[0].startTime)}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {dateShows.map((show) => (
                        <Link
                          key={show.id}
                          href={`/show/${show.id}/seats`}
                          className="bms-show-pill"
                        >
                          {formatTime(show.startTime)}
                          <span className="ml-2 text-xs opacity-70">
                            {show.screenName}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
