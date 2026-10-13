"use client";

import { useEffect, useRef } from "react";
import { clock, RATES } from "@/lib/astro/clock";
import { equatorialToHorizontal, projectHorizontal, stereographicScale } from "@/lib/astro/projection";
import { lstDeg } from "@/lib/astro/time";
import { bvToColor } from "@/lib/astro/color";
import { getStars } from "@/lib/astro/catalog";
import { solarSystemObjects } from "@/lib/astro/bodies";
import { slew } from "@/lib/astro/slew";
import { sys } from "@/lib/os/syscalls";
import { useSkyStore } from "@/store/useSkyStore";

// ── constants (named + units) ─────────────────────────────────────────────────
const HIT_RADIUS_PX = 14;       // pixels – click-selection radius
const HIT_BUFFER_SIZE = 4096;   // objects – preallocated hit buffer (task 1.4)
const MIRROR_INTERVAL_MS = 250; // ms – throttle for React clock mirror
const FOV_MIN_DEG = 0.5;        // degrees (task 1.5)
const FOV_MAX_DEG = 150;        // degrees (task 1.5)
const ALT_MAX_DEG = 89;         // degrees
const DRAG_THRESHOLD_PX = 4;    // pixels – below this a pointerup is a click

// ── preallocated hit buffer (task 1.4) ────────────────────────────────────────
// Re-used every frame; hitCount tracks how many entries are live this frame.
const hitIds = new Array<string>(HIT_BUFFER_SIZE);
const hitX   = new Float32Array(HIT_BUFFER_SIZE);
const hitY   = new Float32Array(HIT_BUFFER_SIZE);

/** Clamp fov to valid range. */
function clampFov(fov: number): number {
  return Math.max(FOV_MIN_DEG, Math.min(FOV_MAX_DEG, fov));
}

/** Clamp altitude to valid range. */
function clampAlt(alt: number): number {
  return Math.max(-ALT_MAX_DEG, Math.min(ALT_MAX_DEG, alt));
}

/** Wrap azimuth to [0, 360). */
function wrapAz(az: number): number {
  return ((az % 360) + 360) % 360;
}

export default function SkyCanvas() {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap   = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    let w = 0, h = 0, raf = 0, lastMirror = 0;
    let hitCount = 0; // live entries in the preallocated hit buffer this frame
    const stars = getStars();

    // ── resize ────────────────────────────────────────────────────────────────
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // ── render loop ───────────────────────────────────────────────────────────
    const frame = (now: number) => {
      const st = useSkyStore.getState();
      clock.tick(now);

      // Throttled React mirror (4 Hz)
      if (now - lastMirror > MIRROR_INTERVAL_MS) {
        lastMirror = now;
        st.setClockMirror({ displayTimeMs: clock.now(), rate: clock.rate, playing: clock.playing });
      }

      // Apply slew animation (task 1.1)
      slew.tick(now);
      if (slew.active) {
        st.setView({ az: slew.az, alt: slew.alt, fov: slew.fov });
      }

      const ms = clock.now();
      const { view, observer, overlays, selectedId } = useSkyStore.getState();
      const lst   = lstDeg(ms, observer.lon);
      const night = overlays.nightMode;
      const fg    = night ? "#ff8a7a" : "#cfe3ff";

      // ── background ──────────────────────────────────────────────────────────
      ctx.fillStyle = night ? "#080202" : "#02040a";
      ctx.fillRect(0, 0, w, h);

      // ── horizon line + cardinal labels ──────────────────────────────────────
      ctx.strokeStyle = night ? "#4a1410" : "#1c2a4a";
      ctx.lineWidth = 1;
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

      // ── object drawing (task 1.4: write into preallocated buffers) ───────────
      hitCount = 0;

      const draw = (
        id: string,
        name: string,
        raDeg: number,
        decDeg: number,
        r: number,
        color: string,
        label: boolean,
      ) => {
        const hz = equatorialToHorizontal(raDeg, decDeg, observer.lat, lst);
        const p  = projectHorizontal(hz.altDeg, hz.azDeg, view, w, h);
        if (!p.visible) return;
        ctx.globalAlpha = hz.altDeg < 0 ? 0.35 : 1;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        if (id === selectedId) {
          ctx.strokeStyle = "#5ec8ff";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2); ctx.stroke();
        }
        if (label && overlays.labels) { ctx.fillStyle = fg; ctx.fillText(name, p.x + r + 4, p.y + 4); }
        ctx.globalAlpha = 1;

        // Write into preallocated buffers (task 1.4 – no per-frame allocation)
        if (hitCount < HIT_BUFFER_SIZE) {
          hitIds[hitCount] = id;
          hitX[hitCount]   = p.x;
          hitY[hitCount]   = p.y;
          hitCount++;
        }
      };

      for (const s of stars) {
        draw(s.id, s.name, s.raDeg, s.decDeg, Math.max(0.9, 3.4 - s.mag * 0.6), night ? "#ff8a7a" : bvToColor(s.bv), s.mag < 2.5);
      }

      if (overlays.planets) {
        for (const b of solarSystemObjects(ms, observer)) {
          const r = b.kind === "sun" ? 9 : b.kind === "moon" ? 8 : 4;
          const c = b.kind === "sun" ? "#ffd86b" : b.kind === "moon" ? "#e8e8e8" : "#ffb86b";
          draw(b.id, b.name, b.raDeg, b.decDeg, r, c, true);
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // ── pointer input (drag pan, click select, pinch zoom) ────────────────────
    let dragging = false;
    let moved = 0;
    let lx = 0, ly = 0;

    // Two-finger pinch state (task 1.2)
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStartDist = 0;
    let pinchStartFov  = 0;

    const onDown = (e: PointerEvent) => {
      slew.cancel(); // any user touch cancels an in-progress slew (task 1.1)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);

      if (pointers.size === 1) {
        dragging = true;
        moved = 0;
        lx = e.clientX;
        ly = e.clientY;
      } else if (pointers.size === 2) {
        // Second finger down — start a pinch (task 1.2)
        dragging = false;
        const pts = [...pointers.values()];
        pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        pinchStartFov  = useSkyStore.getState().view.fov;
      }
    };

    const onMove = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        // Pinch zoom (task 1.2)
        const pts  = [...pointers.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (pinchStartDist > 0) {
          const newFov = clampFov(pinchStartFov * (pinchStartDist / dist));
          useSkyStore.getState().setView({ fov: newFov });
        }
        return;
      }

      if (!dragging) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);

      const { view } = useSkyStore.getState();
      const degPerPx = view.fov / h;
      useSkyStore.getState().setView({
        az:  wrapAz(view.az - dx * degPerPx),   // task 1.5
        alt: clampAlt(view.alt + dy * degPerPx), // task 1.5
      });
    };

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);

      // Reset pinch if we drop back to one finger
      if (pointers.size < 2) {
        pinchStartDist = 0;
        if (pointers.size === 1) {
          const [remaining] = pointers.values();
          lx = remaining.x;
          ly = remaining.y;
          dragging = true;
        }
      }

      if (pointers.size === 0) {
        dragging = false;
        // Click-select (only if the pointer barely moved)
        if (moved < DRAG_THRESHOLD_PX) {
          const rect = canvas.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          let bestId: string | null = null;
          let bestD = HIT_RADIUS_PX;
          for (let i = 0; i < hitCount; i++) {
            const d = Math.hypot(hitX[i] - cx, hitY[i] - cy);
            if (d < bestD) { bestD = d; bestId = hitIds[i]; }
          }
          useSkyStore.getState().select(bestId);
          if (bestId) sys("sys_select_object", { id: bestId });
        }
        moved = 0;
      }
    };

    // Zoom-to-cursor (task 1.3)
    // Algorithm: find the sky point under the cursor, apply zoom, then pan so
    // that same sky point stays at the same pixel.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      slew.cancel();

      const { view } = useSkyStore.getState();
      const rect    = canvas.getBoundingClientRect();
      const cx      = e.clientX - rect.left;  // cursor position in CSS pixels
      const cy      = e.clientY - rect.top;

      const oldFov  = view.fov;
      const newFov  = clampFov(oldFov * Math.exp(e.deltaY * 0.001)); // task 1.5

      // Cursor offset from canvas centre in normalised stereographic coords
      const oldScale = stereographicScale(h, oldFov);
      const newScale = stereographicScale(h, newFov);
      const sxOld = (cx - w / 2) / oldScale;
      const syOld = (cy - h / 2) / (-oldScale); // y axis is flipped in canvas

      // Offset in the new scale
      const sxNew = (cx - w / 2) / newScale;
      const syNew = (cy - h / 2) / (-newScale);

      // Difference in normalised coords → convert to degree shift in az/alt
      // (valid for small offsets; sufficient for interactive zoom)
      const dazDeg = (sxNew - sxOld) * (newFov / h) * (w / h);
      const daltDeg = (syNew - syOld) * (newFov / h);

      useSkyStore.getState().setView({
        fov: newFov,
        az:  wrapAz(view.az - dazDeg),
        alt: clampAlt(view.alt - daltDeg),
      });
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup",   onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // ── keyboard ──────────────────────────────────────────────────────────────
    const onKey = (e: KeyboardEvent) => {
      const st = useSkyStore.getState();
      if (st.searchOpen || e.target instanceof HTMLInputElement) return;

      const step = st.view.fov / 12;
      if (e.key === "ArrowLeft") {
        slew.cancel();
        st.setView({ az: wrapAz(st.view.az - step) });
      } else if (e.key === "ArrowRight") {
        slew.cancel();
        st.setView({ az: wrapAz(st.view.az + step) });
      } else if (e.key === "ArrowUp") {
        slew.cancel();
        st.setView({ alt: clampAlt(st.view.alt + step) });
      } else if (e.key === "ArrowDown") {
        slew.cancel();
        st.setView({ alt: clampAlt(st.view.alt - step) });
      } else if (e.key === "+" || e.key === "=") {
        slew.cancel();
        st.setView({ fov: clampFov(st.view.fov * 0.85) }); // task 1.5
      } else if (e.key === "-") {
        slew.cancel();
        st.setView({ fov: clampFov(st.view.fov / 0.85) }); // task 1.5
      } else if (e.key === " ") {
        e.preventDefault();
        clock.playing = !clock.playing;
        sys("sys_clock_set", { playing: String(clock.playing) });
      } else if (e.key === "]" || e.key === "[") {
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
      canvas.removeEventListener("pointerdown",  onDown);
      canvas.removeEventListener("pointermove",  onMove);
      canvas.removeEventListener("pointerup",    onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel",        onWheel);
      window.removeEventListener("keydown",      onKey);
    };
  }, []);

  return (
    <div className="sky-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        aria-label="Interactive star map. Use arrow keys to pan, +/- to zoom, or click an object to select it."
      />
    </div>
  );
}
