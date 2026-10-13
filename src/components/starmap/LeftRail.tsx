"use client";

import { useSkyStore, type Overlays } from "@/store/useSkyStore";
import { sys } from "@/lib/os/syscalls";

const TOGGLES: [keyof Overlays, string][] = [
  ["constellations", "Const."],
  ["labels", "Labels"],
  ["planets", "Planets"],
  ["gridAltAz", "Alt/Az"],
  ["gridEquatorial", "RA/Dec"],
  ["ground", "Ground"],
  ["nightMode", "Night"],
];

export default function LeftRail() {
  const overlays = useSkyStore((s) => s.overlays);
  const toggle = useSkyStore((s) => s.toggleOverlay);
  const setSearchOpen = useSkyStore((s) => s.setSearchOpen);
  const setObserverOpen = useSkyStore((s) => s.setObserverOpen);
  const setHelpOpen = useSkyStore((s) => s.setHelpOpen);

  return (
    <nav className="rail">
      <button onClick={() => setSearchOpen(true)}>Search /</button>
      {TOGGLES.map(([k, label]) => (
        <button
          key={k}
          className={overlays[k] ? "on" : ""}
          onClick={() => { toggle(k); sys("sys_display_set", { layer: k }); }}
        >
          {label}
        </button>
      ))}
      <button onClick={() => setObserverOpen(true)} title="Set observer coordinates">Location</button>
      <button onClick={() => setHelpOpen(true)} title="Keyboard shortcuts (?)">Help ?</button>
    </nav>
  );
}
