import { create } from "zustand"

export const useSalesCheckStore = create((set) => ({
  it01: null,
  it02: null,
  it03: null,

  setPreview: (entity, data) => set({ [entity]: data }),

  clear: () => set({ it01: null, it02: null, it03: null }),
}))
