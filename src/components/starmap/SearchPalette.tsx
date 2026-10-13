"use client";

import { useEffect, useMemo, useState } from "react";
import { clock } from "@/lib/astro/clock";
import { getAllObjects, horizontalOf } from "@/lib/astro/catalog";
import { buildSearchIndex } from "@/lib/search";
import { slew } from "@/lib/astro/slew";
import { sys } from "@/lib/os/syscalls";
import { useSkyStore } from "@/store/useSkyStore";
import type { SkyObject } from "@/lib/astro/types";

export default function SearchPalette() {
  const open = useSkyStore((s) => s.searchOpen);
  const setOpen = useSkyStore((s) => s.setSearchOpen);
  const observer = useSkyStore((s) => s.observer);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const index = useMemo(() => buildSearchIndex(getAllObjects(Date.now(), observer)), [observer]);
  const results = useMemo(() => index.search(q), [index, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement;
      if ((e.ctrlKey && e.key.toLowerCase() === "k") || (!typing && e.key === "/")) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  if (!open) return null;

  const pick = (o: SkyObject) => {
    const st = useSkyStore.getState();
    const hz = horizontalOf(o, clock.now(), observer);
    st.select(o.id);
    // Smooth 600 ms slew to the object (task 1.1)
    slew.start(st.view, { az: hz.azDeg, alt: hz.altDeg }, performance.now());
    sys("sys_query_catalog", { q, id: o.id });
    setOpen(false);
    setQ("");
  };

  return (
    <div className="overlay" onClick={() => setOpen(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Search: Sirius, alpha cen, HIP 32349, M31, NGC 224..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
            else if (e.key === "Enter" && results[idx]) pick(results[idx]);
          }}
        />
        <ul>
          {results.map((o, i) => (
            <li key={o.id} className={i === idx ? "active" : ""} onClick={() => pick(o)}>
              <span>{o.name}</span><span className="dim">{o.kind} · mag {o.mag.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
