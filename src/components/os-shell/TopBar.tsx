"use client";

import { OS_NAME, APP_NAME, VESSEL_NAME } from "@/config/os";
import { formatSimTime } from "@/lib/astro/time";
import { formatRateLabel } from "@/lib/astro/clock";
import { useSkyStore } from "@/store/useSkyStore";

export default function TopBar() {
  const t = useSkyStore((s) => s.displayTimeMs);
  const rate = useSkyStore((s) => s.rate);
  const obs = useSkyStore((s) => s.observer);
  const setSyscallOpen = useSkyStore((s) => s.setSyscallOpen);
  const syscallOpen = useSkyStore((s) => s.syscallOpen);
  const setObserverOpen = useSkyStore((s) => s.setObserverOpen);

  return (
    <header className="topbar">
      <span><span className="brand">{OS_NAME}</span> <span className="dim">/ {APP_NAME} / {VESSEL_NAME}</span></span>
      <span>{formatSimTime(t)} <span className="dim">[{formatRateLabel(rate)}]</span></span>
      <button
        className="obs-btn"
        onClick={() => setObserverOpen(true)}
        title="Configure observer coordinates"
      >
        <span className="dim">{obs.name}</span> ({obs.lat >= 0 ? `+${obs.lat.toFixed(2)}` : obs.lat.toFixed(2)}°, {obs.lon >= 0 ? `+${obs.lon.toFixed(2)}` : obs.lon.toFixed(2)}°)
      </button>
      <button onClick={() => setSyscallOpen(!syscallOpen)}>syscalls</button>
    </header>
  );
}
