import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PulseStore {
  activeWatchlistId: string | null;
  setActiveWatchlistId: (id: string | null) => void;
}

export const usePulseStore = create<PulseStore>()(
  persist(
    (set) => ({
      activeWatchlistId: null,
      setActiveWatchlistId: (id) => set({ activeWatchlistId: id }),
    }),
    { name: "pulse-active-watchlist" }
  )
);
