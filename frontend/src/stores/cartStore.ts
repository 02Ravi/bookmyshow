import { create } from 'zustand';

interface CartState {
  showId: string | null;
  selectedIds: string[];
  setSelectedIds: (showId: string, ids: Set<string>) => void;
  toggleSeat: (showId: string, showSeatId: string) => void;
  removeSeats: (showId: string, ids: string[]) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  showId: null,
  selectedIds: [],
  setSelectedIds: (showId, ids) =>
    set({ showId, selectedIds: [...ids] }),
  toggleSeat: (showId, showSeatId) => {
    const state = get();
    if (state.showId !== showId) {
      set({ showId, selectedIds: [showSeatId] });
      return;
    }
    const next = new Set(state.selectedIds);
    if (next.has(showSeatId)) {
      next.delete(showSeatId);
    } else {
      next.add(showSeatId);
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
