import { create } from "zustand";
import { DEFAULT_OBSERVER } from "@/config/os";
import type { Observer, ViewState } from "@/lib/astro/types";

export interface SyscallEntry {
  t: number;
  name: string;
  args: string;
  result: string;
}

export interface Overlays {
  constellations: boolean;
  labels: boolean;
  gridAltAz: boolean;
  gridEquatorial: boolean;
  planets: boolean;
  ground: boolean;
  nightMode: boolean;
}

interface SkyState {
  booted: boolean;
  observer: Observer;
  view: ViewState;
  selectedId: string | null;
  tracking: boolean;
  searchOpen: boolean;
  syscallOpen: boolean;
  observerOpen: boolean;
  helpOpen: boolean;
  overlays: Overlays;
  // throttled mirrors of the clock (the real clock lives in lib/astro/clock.ts)
  displayTimeMs: number;
  rate: number;
  playing: boolean;
  syscalls: SyscallEntry[];

  setBooted: (v: boolean) => void;
  setObserver: (o: Observer) => void;
  setView: (v: Partial<ViewState>) => void;
  select: (id: string | null) => void;
  setTracking: (v: boolean) => void;
  toggleTracking: () => void;
  setSearchOpen: (v: boolean) => void;
  setSyscallOpen: (v: boolean) => void;
  setObserverOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
  toggleOverlay: (k: keyof Overlays) => void;
  setClockMirror: (m: { displayTimeMs?: number; rate?: number; playing?: boolean }) => void;
  pushSyscall: (e: SyscallEntry) => void;
}

export const useSkyStore = create<SkyState>((set) => ({
  booted: false,
  observer: DEFAULT_OBSERVER,
  view: { az: 180, alt: 45, fov: 90 },
  selectedId: null,
  tracking: false,
  searchOpen: false,
  syscallOpen: false,
  observerOpen: false,
  helpOpen: false,
  overlays: {
    constellations: true,
    labels: true,
    gridAltAz: false,
    gridEquatorial: false,
    planets: true,
    ground: true,
    nightMode: false,
  },
  displayTimeMs: Date.now(),
  rate: 1,
  playing: true,
  syscalls: [],

  setBooted: (booted) => set({ booted }),
  setObserver: (observer) => set({ observer }),
  setView: (v) =>
    set((s) => ({
      view: {
        az:  (((((v.az  ?? s.view.az)  % 360) + 360) % 360)),
        alt: Math.max(-89, Math.min(89,  v.alt ?? s.view.alt)),
        fov: Math.max(0.5, Math.min(150, v.fov ?? s.view.fov)),
      },
    })),
  select: (selectedId) => set({ selectedId, tracking: selectedId ? undefined : false }),
  setTracking: (tracking) => set({ tracking }),
  toggleTracking: () => set((s) => ({ tracking: s.selectedId ? !s.tracking : false })),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setSyscallOpen: (syscallOpen) => set({ syscallOpen }),
  setObserverOpen: (observerOpen) => set({ observerOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  toggleOverlay: (k) => set((s) => ({ overlays: { ...s.overlays, [k]: !s.overlays[k] } })),
  setClockMirror: (m) => set(m),
  pushSyscall: (e) => set((s) => ({ syscalls: [...s.syscalls.slice(-199), e] })),
}));

