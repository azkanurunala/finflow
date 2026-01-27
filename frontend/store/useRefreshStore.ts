import { create } from 'zustand';

interface RefreshState {
  lastInteraction: number;
  triggerRefresh: () => void;
}

export const useRefreshStore = create<RefreshState>((set) => ({
  lastInteraction: Date.now(),
  triggerRefresh: () => set({ lastInteraction: Date.now() }),
}));
