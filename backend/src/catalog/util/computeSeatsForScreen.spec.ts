import {
  computeSeatsForScreen,
  type LayoutConfig,
} from './computeSeatsForScreen';

describe('computeSeatsForScreen', () => {
  it('returns an empty list for empty rows', () => {
    const config: LayoutConfig = { rows: [] };
    expect(computeSeatsForScreen(config, 200)).toEqual([]);
  });

  it('returns an empty list for null / invalid config', () => {
    expect(computeSeatsForScreen(null, 200)).toEqual([]);
    expect(computeSeatsForScreen({}, 200)).toEqual([]);
    expect(computeSeatsForScreen({ rows: 'bad' }, 200)).toEqual([]);
  });

  it('expands a single row with correct labels and price', () => {
    const config: LayoutConfig = {
      rows: [{ row: 'A', seats: 3, type: 'REGULAR', priceMultiplier: 1 }],
    };
    expect(computeSeatsForScreen(config, 200)).toEqual([
      { seatLabel: 'A1', row: 'A', number: 1, type: 'REGULAR', price: 200 },
      { seatLabel: 'A2', row: 'A', number: 2, type: 'REGULAR', price: 200 },
      { seatLabel: 'A3', row: 'A', number: 3, type: 'REGULAR', price: 200 },
    ]);
  });

  it('supports multiple seat types with price multipliers', () => {
    const config: LayoutConfig = {
      rows: [
        { row: 'A', seats: 2, type: 'REGULAR', priceMultiplier: 1 },
        { row: 'G', seats: 2, type: 'PREMIUM', priceMultiplier: 1.5 },
        { row: 'H', seats: 1, type: 'RECLINER', priceMultiplier: 2 },
      ],
    };
    const seats = computeSeatsForScreen(config, 200);
    expect(seats).toEqual([
      { seatLabel: 'A1', row: 'A', number: 1, type: 'REGULAR', price: 200 },
      { seatLabel: 'A2', row: 'A', number: 2, type: 'REGULAR', price: 200 },
      { seatLabel: 'G1', row: 'G', number: 1, type: 'PREMIUM', price: 300 },
      { seatLabel: 'G2', row: 'G', number: 2, type: 'PREMIUM', price: 300 },
      { seatLabel: 'H1', row: 'H', number: 1, type: 'RECLINER', price: 400 },
    ]);
  });

  it('skips rows with zero seats', () => {
    const config: LayoutConfig = {
      rows: [
        { row: 'A', seats: 0, type: 'REGULAR', priceMultiplier: 1 },
        { row: 'B', seats: 1, type: 'REGULAR', priceMultiplier: 1 },
      ],
    };
    expect(computeSeatsForScreen(config, 100)).toEqual([
      { seatLabel: 'B1', row: 'B', number: 1, type: 'REGULAR', price: 100 },
    ]);
  });
});
