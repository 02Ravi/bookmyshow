import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProfileState {
  userId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  setUser: (user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  }) => void;
  clearUser: () => void;
}

export const useAuthStore = create<ProfileState>()(
  persist(
    (set) => ({
      userId: null,
      name: null,
      email: null,
      phone: null,
      setUser: (user) =>
        set({
          userId: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone ?? null,
        }),
      clearUser: () =>
        set({ userId: null, name: null, email: null, phone: null }),
    }),
    { name: 'bms-auth' },
  ),
);
