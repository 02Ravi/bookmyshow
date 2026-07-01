import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProfileState {
  userId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export const useAuthStore = create<ProfileState>()(
  persist(
    (set) => ({
      userId: null,
      name: null,
      email: null,
      phone: null,
    }),
    { name: 'bms-auth' },
  ),
);
