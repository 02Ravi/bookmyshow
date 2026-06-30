'use client';

import { Suspense } from 'react';
import { BookingsContent } from './BookingsContent';

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-6 py-8">
          <p className="text-gray-600">Loading...</p>
        </main>
      }
    >
      <BookingsContent />
    </Suspense>
  );
}

