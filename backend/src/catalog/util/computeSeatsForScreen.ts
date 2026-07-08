export type SeatType = 'REGULAR' | 'PREMIUM' | 'RECLINER';

export interface LayoutRow {
  row: string;
  seats: number;
  type: SeatType | string;
  priceMultiplier: number;
}

export interface LayoutConfig {
  rows: LayoutRow[];
}

export interface SeatInfo {
  seatLabel: string;
  row: string;
  number: number;
  type: string;
  price: number;
}

function isLayoutRow(value: unknown): value is LayoutRow {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.row === 'string' &&
    typeof row.seats === 'number' &&
    Number.isFinite(row.seats) &&
    row.seats >= 0 &&
    typeof row.type === 'string' &&
    typeof row.priceMultiplier === 'number' &&
    Number.isFinite(row.priceMultiplier)
  );
}

function parseLayoutConfig(layoutConfig: unknown): LayoutConfig {
  if (!layoutConfig || typeof layoutConfig !== 'object') {
    return { rows: [] };
  }
  const raw = layoutConfig as Record<string, unknown>;
  if (!Array.isArray(raw.rows)) {
    return { rows: [] };
  }
  return { rows: raw.rows.filter(isLayoutRow) };
}

/**
 * Pure function: expands a screen's layoutConfig into the full seat list for a
 * show. No DB rows are created — seat availability is computed by subtracting
 * BookedSeat + Redis holds from this list.
 *
 * seatLabel format: `${row}${number}` (e.g. "A5", "H10").
 */
export function computeSeatsForScreen(
  layoutConfig: unknown,
  basePrice: number,
): SeatInfo[] {
  const config = parseLayoutConfig(layoutConfig);
  const seats: SeatInfo[] = [];

  for (const row of config.rows) {
    const count = Math.floor(row.seats);
    for (let number = 1; number <= count; number++) {
      const price = Number((basePrice * row.priceMultiplier).toFixed(2));
      seats.push({
        seatLabel: `${row.row}${number}`,
        row: row.row,
        number,
        type: row.type,
        price,
      });
    }
  }

  return seats;
}
