import { create } from 'zustand';

interface CartState {
  showId: string | null;
  selectedIds: string[];
  toggleSeat: (showId: string, seatLabel: string) => void;
  removeSeats: (showId: string, ids: string[]) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  showId: null,
  selectedIds: [],
  toggleSeat: (showId, seatLabel) => {
    const state = get();
    if (state.showId !== showId) {
      set({ showId, selectedIds: [seatLabel] });
      return;
    }
    const next = new Set(state.selectedIds);
    if (next.has(seatLabel)) {
      next.delete(seatLabel);
    } else {
      next.add(seatLabel);
    }
    set({ selectedIds: [...next] });
  },
  removeSeats: (showId, ids) => {
    const state = get();
    if (state.showId !== showId) return;
    const next = state.selectedIds.filter((id) => !ids.includes(id));
    set({ selectedIds: next });
  },
  clearCart: () => set({ showId: null, selectedIds: [] }),
}));
