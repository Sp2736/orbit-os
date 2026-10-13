"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import { clock } from "@/lib/astro/clock";
import { getAllObjects, horizontalOf } from "@/lib/astro/catalog";
import { buildSearchIndex, type SearchIndex } from "@/lib/search";
import { slew } from "@/lib/astro/slew";
import { sys } from "@/lib/os/syscalls";
import { useSkyStore } from "@/store/useSkyStore";
import type { SkyObject } from "@/lib/astro/types";

const KIND_METAS: Record<string, { bg: string; text: string; label: string }> = {
  star:    { bg: "rgba(94, 200, 255, 0.15)", text: "#5ec8ff", label: "Star" },
  planet:  { bg: "rgba(255, 179, 71, 0.15)",  text: "#ffb347", label: "Planet" },
  sun:     { bg: "rgba(255, 230, 100, 0.2)",  text: "#ffe664", label: "Sun" },
  moon:    { bg: "rgba(200, 225, 255, 0.2)",  text: "#cfe3ff", label: "Moon" },
  galaxy:  { bg: "rgba(157, 123, 255, 0.2)",  text: "#9d7bff", label: "Galaxy" },
  nebula:  { bg: "rgba(255, 110, 199, 0.18)", text: "#ff6ec7", label: "Nebula" },
  cluster: { bg: "rgba(74, 222, 128, 0.18)",  text: "#4ade80", label: "Cluster" },
  other:   { bg: "rgba(111, 134, 173, 0.15)", text: "#8fa5cc", label: "DSO" },
};

function HighlightMatchedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const qClean = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(qClean);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="search-highlight">{text.slice(idx, idx + qClean.length)}</span>
      {text.slice(idx + qClean.length)}
    </>
  );
}

// In-memory recent searches store (persists for session)
let recentSearchesMemory: SkyObject[] = [];

// Cached search index
let cachedIndex: SearchIndex | null = null;
let cachedObsKey = "";

export default function SearchPalette() {
  const open = useSkyStore((s) => s.searchOpen);
  const setOpen = useSkyStore((s) => s.setSearchOpen);
  const observer = useSkyStore((s) => s.observer);
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [idx, setIdx] = useState(0);

  // Maintain search index once
  const obsKey = `${observer.lat},${observer.lon}`;
  const index = useMemo(() => {
    if (!cachedIndex || cachedObsKey !== obsKey) {
      cachedIndex = buildSearchIndex(getAllObjects(Date.now(), observer));
      cachedObsKey = obsKey;
    }
    return cachedIndex;
  }, [obsKey, observer]);

  // Suggestions for empty query
  const suggestions = useMemo(() => {
    return [
      ...index.search("Sirius", 1),
      ...index.search("Orion Nebula", 1),
      ...index.search("Mars", 1),
      ...index.search("Moon", 1),
    ];
  }, [index]);

  // Active items to display
  const isQueryEmpty = !deferredQ.trim();
  const results = useMemo(() => {
    if (isQueryEmpty) return [];
    return index.search(deferredQ, 8);
  }, [index, deferredQ, isQueryEmpty]);

  const displayList = useMemo(() => {
    if (!isQueryEmpty) return results;
    // When empty, show recent searches followed by suggestions
    const items = [...recentSearchesMemory];
    for (const sug of suggestions) {
      if (!items.some((x) => x.id === sug.id)) items.push(sug);
    }
    return items.slice(0, 8);
  }, [isQueryEmpty, results, suggestions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement;
      if ((e.ctrlKey && e.key.toLowerCase() === "k") || (!typing && e.key === "/")) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  if (!open) return null;

  const pick = (o: SkyObject) => {
    const st = useSkyStore.getState();
    const hz = horizontalOf(o, clock.now(), observer);
    st.select(o.id);

    // Update in-memory recent searches (last 5)
    recentSearchesMemory = [o, ...recentSearchesMemory.filter((x) => x.id !== o.id)].slice(0, 5);

    // Smooth 600 ms slew to object
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
          placeholder="Search: Sirius, alpha cen, HIP 32349, M31, NGC 224, Mars..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(displayList.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" && displayList[idx]) {
              pick(displayList[idx]);
            }
          }}
        />

        {isQueryEmpty && (
          <div className="search-header-label">
            {recentSearchesMemory.length > 0 ? "Recent Searches & Suggestions" : "Suggested Celestial Objects"}
          </div>
        )}

        {!isQueryEmpty && results.length === 0 && (
          <div className="search-empty">
            <div className="empty-title">NO CELESTIAL OBJECT FOUND</div>
            <div className="empty-hint">
              <p style={{ marginBottom: 6 }}>Try searching by any of the accepted formats:</p>
              <ul style={{ paddingLeft: 18, margin: "4px 0" }}>
                <li><b>Proper name:</b> <code>Sirius</code>, <code>Betelgeuse</code>, <code>Polaris</code></li>
                <li><b>Bayer / Flamsteed:</b> <code>α CMa</code>, <code>alpha orionis</code>, <code>61 Cygni</code></li>
                <li><b>Star catalogs:</b> <code>HIP 32349</code>, <code>HD 48915</code>, <code>HR 2491</code>, <code>GJ 551</code></li>
                <li><b>Deep sky:</b> <code>M31</code>, <code>NGC 224</code>, <code>IC 434</code></li>
                <li><b>Solar system:</b> <code>Mars</code>, <code>Moon</code>, <code>Sun</code>, <code>Jupiter</code></li>
              </ul>
            </div>
          </div>
        )}

        <ul>
          {displayList.map((o, i) => {
            const meta = KIND_METAS[o.kind] || KIND_METAS.other;
            return (
              <li key={o.id} className={i === idx ? "active" : ""} onClick={() => pick(o)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    className="search-badge"
                    style={{ background: meta.bg, color: meta.text }}
                  >
                    {meta.label}
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    <HighlightMatchedText text={o.name} query={deferredQ} />
                  </span>
                  {o.constellation && <span className="dim">({o.constellation})</span>}
                </div>
                <span className="dim">
                  mag {o.mag.toFixed(1)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
