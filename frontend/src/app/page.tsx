'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { fetchMovies } from '@/lib/movies-api';

export default function HomePage() {
  const { data: movies = [], isLoading, error } = useQuery({
    queryKey: ['movies'],
    queryFn: fetchMovies,
  });

  return (
    <main>
      <section className="bg-[var(--bms-header)] px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold md:text-4xl">
            It&apos;s movie time!
          </h1>
          <p className="mt-2 text-gray-300">
            Book tickets for the latest blockbusters near you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="mb-6 text-xl font-bold text-[var(--bms-text)]">
          Recommended Movies
        </h2>

        {isLoading && (
          <p className="text-[var(--bms-text-muted)]">Loading movies...</p>
        )}

        {error && (
          <p className="text-red-600">
            Failed to load movies. Is the API running?
          </p>
        )}

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {movies.map((movie) => (
            <Link
              key={movie.id}
              href={`/movie/${movie.id}`}
              className="group bms-card overflow-hidden transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-[2/3] w-full bg-gray-100">
                <Image
                  src={movie.posterUrl}
                  alt={movie.title}
                  fill
                  unoptimized
                  className="object-cover transition group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              </div>
              <div className="p-3">
                <h3 className="line-clamp-1 font-semibold text-[var(--bms-text)]">
                  {movie.title}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-[var(--bms-text-muted)]">
                    {movie.genre}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-[var(--bms-text-muted)]">
                    {movie.language}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--bms-text-muted)]">
                  {movie.durationMinutes} min
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
