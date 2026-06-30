'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export function NavBar() {
  const userId = useAuthStore((s) => s.userId);
  const name = useAuthStore((s) => s.name);
  const clearUser = useAuthStore((s) => s.clearUser);

  return (
    <header className="bg-[var(--bms-header)] shadow-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-1">
          <span className="text-2xl font-extrabold tracking-tight text-[var(--bms-red)]">
            book
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-white">
            my
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-[var(--bms-red)]">
            show
          </span>
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium">
          <Link
            href="/"
            className="text-gray-300 transition hover:text-white"
          >
            Movies
          </Link>
          <Link
            href={userId ? `/bookings?userId=${userId}` : '/bookings'}
            className="text-gray-300 transition hover:text-white"
          >
            My Bookings
          </Link>
          {userId && name ? (
            <div className="flex items-center gap-3 border-l border-gray-600 pl-6">
              <span className="text-gray-300">Hi, {name}</span>
              <button
                type="button"
                onClick={clearUser}
                className="text-xs text-gray-400 hover:text-[var(--bms-red)]"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
