import { Suspense } from 'react';
import { SeatMapPageClient } from './SeatMapPageClient';

interface SeatMapPageProps {
  params: Promise<{ id: string }>;
}

export default async function SeatMapPage({ params }: SeatMapPageProps) {
  const { id: showId } = await params;

  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl p-6">
          <p className="text-gray-600">Loading...</p>
        </main>
      }
    >
      <SeatMapPageClient showId={showId} />
    </Suspense>
  );
}
