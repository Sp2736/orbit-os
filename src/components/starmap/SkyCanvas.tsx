"use client";

import { useEffect, useRef } from "react";
import { clock, RATES } from "@/lib/astro/clock";
import { equatorialToHorizontal, projectHorizontal } from "@/lib/astro/projection";
import { lstDeg } from "@/lib/astro/time";
import { bvToColor } from "@/lib/astro/color";
import { getStars } from "@/lib/astro/catalog";
import { solarSystemObjects } from "@/lib/astro/bodies";
import { sys } from "@/lib/os/syscalls";
import { useSkyStore } from "@/store/useSkyStore";

interface Hit { id: string; x: number; y: number }

export default function SkyCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hits = useRef<Hit[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0, raf = 0, lastMirror = 0;
    const stars = getStars();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = wrap.clientWidth; h = wrap.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const frame = (now: number) => {
      const st = useSkyStore.getState();
      clock.tick(now);
      if (now - lastMirror > 250) {
        lastMirror = now;
        st.setClockMirror({ displayTimeMs: clock.now(), rate: clock.rate, playing: clock.playing });
      }
      const ms = clock.now();
      const { view, observer, overlays, selectedId } = st;
      const lst = lstDeg(ms, observer.lon);
      const night = overlays.nightMode;
      const fg = night ? "#ff8a7a" : "#cfe3ff";

      ctx.fillStyle = night ? "#080202" : "#02040a";
      ctx.fillRect(0, 0, w, h);

      // horizon + cardinal points
      ctx.strokeStyle = night ? "#4a1410" : "#1c2a4a";
      ctx.beginPath();
      let started = false;
      for (let az = 0; az <= 360; az += 3) {
        const p = projectHorizontal(0, az, view, w, h);
        if (!p.visible) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.fillStyle = night ? "#8a3a33" : "#6f86ad";
      ctx.font = "12px monospace";
      for (const [label, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]] as const) {
        const p = projectHorizontal(0, az, view, w, h);
        if (p.visible) ctx.fillText(label, p.x - 4, p.y - 6);
      }
      // TODO(agent): ground fill, alt/az + equatorial grids, constellation lines (docs/07-ui-spec.md)

      const nextHits: Hit[] = [];
      const draw = (id: string, name: string, raDeg: number, decDeg: number, r: number, color: string, label: boolean) => {
        const hz = equatorialToHorizontal(raDeg, decDeg, observer.lat, lst);
        const p = projectHorizontal(hz.altDeg, hz.azDeg, view, w, h);
        if (!p.visible) return;
        ctx.globalAlpha = hz.altDeg < 0 ? 0.35 : 1;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        if (id === selectedId) {
          ctx.strokeStyle = "#5ec8ff"; ctx.beginPath(); ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2); ctx.stroke();
        }
        if (label && overlays.labels) { ctx.fillStyle = fg; ctx.fillText(name, p.x + r + 4, p.y + 4); }
        ctx.globalAlpha = 1;
        nextHits.push({ id, x: p.x, y: p.y });
      };

      for (const s of stars) draw(s.id, s.name, s.raDeg, s.decDeg, Math.max(0.9, 3.4 - s.mag * 0.6), night ? "#ff8a7a" : bvToColor(s.bv), s.mag < 2.5);
      if (overlays.planets) {
        for (const b of solarSystemObjects(ms, observer)) {
          const r = b.kind === "sun" ? 9 : b.kind === "moon" ? 8 : 4;
          const c = b.kind === "sun" ? "#ffd86b" : b.kind === "moon" ? "#e8e8e8" : "#ffb86b";
          draw(b.id, b.name, b.raDeg, b.decDeg, r, c, true);
        }
      }
      hits.current = nextHits;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // --- input ---
    let dragging = false, moved = 0, lx = 0, ly = 0;
    const onDown = (e: PointerEvent) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      const { view } = useSkyStore.getState();
      const degPerPx = view.fov / h;
      useSkyStore.getState().setView({
        az: (((view.az - dx * degPerPx) % 360) + 360) % 360,
        alt: Math.max(-89, Math.min(89, view.alt + dy * degPerPx)),
      });
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      if (moved < 4) {
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        let best: Hit | null = null, bestD = 14;
        for (const hit of hits.current) {
          const d = Math.hypot(hit.x - x, hit.y - y);
          if (d < bestD) { bestD = d; best = hit; }
        }
        useSkyStore.getState().select(best ? best.id : null);
        if (best) sys("sys_select_object", { id: best.id });
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { view } = useSkyStore.getState();
      useSkyStore.getState().setView({ fov: Math.max(2, Math.min(150, view.fov * Math.exp(e.deltaY * 0.001))) });
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const onKey = (e: KeyboardEvent) => {
      const st = useSkyStore.getState();
      if (st.searchOpen || (e.target instanceof HTMLInputElement)) return;
      const step = st.view.fov / 12;
      if (e.key === "ArrowLeft") st.setView({ az: (st.view.az - step + 360) % 360 });
      else if (e.key === "ArrowRight") st.setView({ az: (st.view.az + step) % 360 });
      else if (e.key === "ArrowUp") st.setView({ alt: Math.min(89, st.view.alt + step) });
      else if (e.key === "ArrowDown") st.setView({ alt: Math.max(-89, st.view.alt - step) });
      else if (e.key === "+" || e.key === "=") st.setView({ fov: Math.max(2, st.view.fov * 0.85) });
      else if (e.key === "-") st.setView({ fov: Math.min(150, st.view.fov / 0.85) });
      else if (e.key === " ") { e.preventDefault(); clock.playing = !clock.playing; sys("sys_clock_set", { playing: String(clock.playing) }); }
      else if (e.key === "]" || e.key === "[") {
        const i = RATES.indexOf(Math.abs(clock.rate));
        const j = Math.max(0, Math.min(RATES.length - 1, i + (e.key === "]" ? 1 : -1)));
        clock.rate = Math.sign(clock.rate || 1) * RATES[j];
        sys("sys_clock_set", { rate: clock.rate });
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="sky-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}
