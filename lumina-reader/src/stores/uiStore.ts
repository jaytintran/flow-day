import { create } from "zustand";

export const useUIStore = create<{
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedIds: number[];
  toggleSelected: (id: number) => void;
  clearSelection: () => void;
  isEditingMetadata: boolean;
  setIsEditingMetadata: (editing: boolean) => void;
  mobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;
}>((set) => ({
  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectedIds: [],
  toggleSelected: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
  clearSelection: () => set({ selectedIds: [] }),
  isEditingMetadata: false,
  setIsEditingMetadata: (editing) => set({ isEditingMetadata: editing }),
  mobileDrawerOpen: false,
  setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),
}));
