"use client";

import { OS_NAME, APP_NAME, VESSEL_NAME } from "@/config/os";
import { formatSimTime } from "@/lib/astro/time";
import { useSkyStore } from "@/store/useSkyStore";

export default function TopBar() {
  const t = useSkyStore((s) => s.displayTimeMs);
  const rate = useSkyStore((s) => s.rate);
  const obs = useSkyStore((s) => s.observer);
  const setSyscallOpen = useSkyStore((s) => s.setSyscallOpen);
  const syscallOpen = useSkyStore((s) => s.syscallOpen);

  return (
    <header className="topbar">
      <span><span className="brand">{OS_NAME}</span> <span className="dim">/ {APP_NAME} / {VESSEL_NAME}</span></span>
      <span>{formatSimTime(t)} <span className="dim">x{rate}</span></span>
      <span className="dim">{obs.name} {obs.lat.toFixed(2)}, {obs.lon.toFixed(2)}</span>
      <button onClick={() => setSyscallOpen(!syscallOpen)}>syscalls</button>
    </header>
  );
}
