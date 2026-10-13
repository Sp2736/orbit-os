"use client";

import { useEffect, useRef } from "react";
import { clock, RATES } from "@/lib/astro/clock";
import { equatorialToHorizontal, projectHorizontal, stereographicScale } from "@/lib/astro/projection";
import { lstDeg } from "@/lib/astro/time";
import { bvToColor } from "@/lib/astro/color";
import {
  getStarCatalog,
  getDeepSkyCatalog,
  getConstellations,
  computeViewMatrix,
  getMagLimitForFov,
  getStarCutoffIndex,
} from "@/lib/astro/catalogLoader";
import {
  getSunHorizontal,
  drawSkyBackground,
  drawGround,
  drawEcliptic,
  drawGrids,
  drawMoon,
  drawPlanet,
} from "@/lib/astro/skyRender";
import { solarSystemObjects } from "@/lib/astro/bodies";
import { findObject, horizontalOf } from "@/lib/astro/catalog";
import { slew } from "@/lib/astro/slew";

import { sys } from "@/lib/os/syscalls";
import { useSkyStore } from "@/store/useSkyStore";

// ── constants (named + units) ─────────────────────────────────────────────────
const HIT_RADIUS_PX = 14;       // pixels – click-selection radius
const HIT_BUFFER_SIZE = 8192;   // objects – preallocated hit buffer (task 1.4, 2.3)
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
      } else if (st.tracking && st.selectedId) {
        const msNow = clock.now();
        const selObj = findObject(st.selectedId, msNow, st.observer);
        if (selObj) {
          const selHz = horizontalOf(selObj, msNow, st.observer);
          st.setView({ az: selHz.azDeg, alt: selHz.altDeg });
        }
      }

      const ms = clock.now();

      const { view, observer, overlays, selectedId } = useSkyStore.getState();
      const lst   = lstDeg(ms, observer.lon);
      const night = overlays.nightMode;
      const fg    = night ? "#ff8a7a" : "#cfe3ff";
      const s     = stereographicScale(h, view.fov);
      const halfW = w / 2;
      const halfH = h / 2;

      // ── sun position & sky background (phase 3 tasks 3.2, 3.4) ─────────────
      const sunHor = getSunHorizontal(ms, observer);
      const { starAlpha } = drawSkyBackground(ctx, sunHor.altDeg, w, h, night);

      // ── grids (alt/az and equatorial) ───────────────────────────────────────
      drawGrids(ctx, overlays, observer, lst, view, w, h, night);

      // ── ecliptic line (passes through planets) ──────────────────────────────
      drawEcliptic(ctx, observer, lst, view, w, h, night);

      // ── constellation lines (phase 3 task 3.1) ──────────────────────────────
      if (overlays.constellations) {
        const cons = getConstellations();
        if (cons) {
          ctx.strokeStyle = night ? "#3a1a16" : "#1a2c47";
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (const f of cons.lines) {
            for (const seg of f.segments) {
              const hz1 = equatorialToHorizontal(seg[0], seg[1], observer.lat, lst);
              const hz2 = equatorialToHorizontal(seg[2], seg[3], observer.lat, lst);
              const p1  = projectHorizontal(hz1.altDeg, hz1.azDeg, view, w, h);
              const p2  = projectHorizontal(hz2.altDeg, hz2.azDeg, view, w, h);
              if (p1.visible && p2.visible) {
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
              }
            }
          }
          ctx.stroke();

          if (overlays.labels) {
            ctx.fillStyle = night ? "#6a2e26" : "#2d4b73";
            ctx.font = "11px monospace";
            for (const lbl of cons.labels) {
              const hz = equatorialToHorizontal(lbl.raDeg, lbl.decDeg, observer.lat, lst);
              const p  = projectHorizontal(hz.altDeg, hz.azDeg, view, w, h);
              if (p.visible) {
                ctx.fillText(lbl.name.toUpperCase(), p.x - 16, p.y);
              }
            }
          }
        }
      }

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

      // ── ground fill (task 3.2: occludes stars below horizon when enabled) ───
      if (overlays.ground) {
        drawGround(ctx, view, w, h, night);
      }

      // ── object drawing: typed-array path with magnitude cutoff (task 2.3) ───
      hitCount = 0;

      const vm = computeViewMatrix(observer.lat, lst, view.az, view.alt);
      const starCat = getStarCatalog();
      if (starCat && starAlpha > 0) {
        const magLimit = getMagLimitForFov(view.fov);
        const cutoff   = getStarCutoffIndex(magLimit);

        ctx.font = "11px monospace";
        for (let i = 0; i < cutoff; i++) {
          const sx = starCat.ux[i];
          const sy = starCat.uy[i];
          const sz = starCat.uz[i];

          const cosc = vm.rz0 * sx + vm.rz1 * sy + vm.rz2 * sz;
          if (cosc <= -0.999) continue;

          const pxRaw = vm.rx0 * sx + vm.rx1 * sy + vm.rx2 * sz;
          const pyRaw = vm.ry0 * sx + vm.ry1 * sy + vm.ry2 * sz;

          const k  = 2 / (1 + cosc);
          const px = halfW + (k * pxRaw) * s;
          const py = halfH - (k * pyRaw) * s;

          if (px < -10 || px > w + 10 || py < -10 || py > h + 10) continue;

          const sinAlt = vm.m20 * sx + vm.m21 * sy + vm.m22 * sz;
          if (overlays.ground && sinAlt < 0) continue; // Occlude below horizon

          const mag = starCat.mag[i];
          const r   = Math.max(0.8, 3.4 - mag * 0.45);

          // Atmospheric extinction near horizon (task 3.7: dim low stars)
          let alpha = starAlpha;
          if (sinAlt > 0 && sinAlt < 0.25) {
            alpha *= (0.4 + sinAlt * 2.4);
          } else if (sinAlt <= 0) {
            alpha *= 0.35;
          }

          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.fillStyle   = night ? "#ff8a7a" : bvToColor(starCat.bv[i]);
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();

          const id = starCat.ids[i];
          if (id === selectedId) {
            ctx.strokeStyle = "#5ec8ff";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, r + 7, 0, Math.PI * 2);
            ctx.stroke();
          }

          if (overlays.labels && mag < 2.5 && starCat.names[i]) {
            ctx.fillStyle = fg;
            ctx.fillText(starCat.names[i], px + r + 4, py + 4);
          }

          if (hitCount < HIT_BUFFER_SIZE) {
            hitIds[hitCount] = id;
            hitX[hitCount]   = px;
            hitY[hitCount]   = py;
            hitCount++;
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── deep-sky objects (typed-array path) ─────────────────────────────────
      const dsoCat = getDeepSkyCatalog();
      if (dsoCat && starAlpha > 0.3) {
        const magLimit = getMagLimitForFov(view.fov);
        for (let i = 0; i < dsoCat.count; i++) {
          const isMessier = dsoCat.mNums[i] !== null;
          const mag = dsoCat.mag[i];
          if (!isMessier && mag > magLimit) continue;

          const sx = dsoCat.ux[i];
          const sy = dsoCat.uy[i];
          const sz = dsoCat.uz[i];

          const cosc = vm.rz0 * sx + vm.rz1 * sy + vm.rz2 * sz;
          if (cosc <= -0.999) continue;

          const pxRaw = vm.rx0 * sx + vm.rx1 * sy + vm.rx2 * sz;
          const pyRaw = vm.ry0 * sx + vm.ry1 * sy + vm.ry2 * sz;

          const k  = 2 / (1 + cosc);
          const px = halfW + (k * pxRaw) * s;
          const py = halfH - (k * pyRaw) * s;

          if (px < -15 || px > w + 15 || py < -15 || py > h + 15) continue;

          const sinAlt = vm.m20 * sx + vm.m21 * sy + vm.m22 * sz;
          if (overlays.ground && sinAlt < 0) continue;

          const id = dsoCat.ids[i];
          ctx.strokeStyle = night ? "#e06050" : "#60a5fa";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.stroke();

          if (id === selectedId) {
            ctx.strokeStyle = "#5ec8ff";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(px, py, 11, 0, Math.PI * 2);
            ctx.stroke();
          }

          if (overlays.labels && (isMessier || mag < 8)) {
            ctx.fillStyle = night ? "#e08070" : "#93c5fd";
            ctx.fillText(dsoCat.names[i] || id, px + 7, py + 4);
          }

          if (hitCount < HIT_BUFFER_SIZE) {
            hitIds[hitCount] = id;
            hitX[hitCount]   = px;
            hitY[hitCount]   = py;
            hitCount++;
          }
        }
      }

      // ── solar-system bodies (tasks 3.5, 3.6) ────────────────────────────────
      if (overlays.planets) {
        for (const b of solarSystemObjects(ms, observer)) {
          const hz = equatorialToHorizontal(b.raDeg, b.decDeg, observer.lat, lst);
          const p  = projectHorizontal(hz.altDeg, hz.azDeg, view, w, h);
          if (!p.visible) continue;
          if (overlays.ground && hz.altDeg < 0) continue;

          if (b.kind === "sun") {
            // Sun: radiant yellow disc with atmospheric glow
            const grad = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 24);
            grad.addColorStop(0, "#fff59d");
            grad.addColorStop(0.3, "rgba(255, 238, 88, 0.8)");
            grad.addColorStop(1, "rgba(255, 214, 0, 0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#fff9c4";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
            ctx.fill();
          } else if (b.kind === "moon") {
            // Moon: illumination phase and orientation (task 3.5)
            drawMoon(ctx, p.x, p.y, 9, new Date(ms), night);
          } else {
            // Planet: distinct colors and Saturn ring (task 3.6)
            drawPlanet(ctx, b.id, p.x, p.y, night);
          }

          if (b.id === selectedId) {
            ctx.strokeStyle = "#5ec8ff";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
            ctx.stroke();
          }

          if (overlays.labels) {
            ctx.fillStyle = fg;
            ctx.fillText(b.name, p.x + 12, p.y + 4);
          }

          if (hitCount < HIT_BUFFER_SIZE) {
            hitIds[hitCount] = b.id;
            hitX[hitCount]   = p.x;
            hitY[hitCount]   = p.y;
            hitCount++;
          }
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
      const st = useSkyStore.getState();
      if (st.tracking) st.setTracking(false);
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);

      const { view } = st;
      const degPerPx = view.fov / h;
      st.setView({
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

      const k = e.key.toLowerCase();
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
        st.setClockMirror({ playing: clock.playing });
        sys("sys_clock_set", { playing: String(clock.playing) });
      } else if (e.key === "]" || e.key === "[") {
        const curAbs = Math.abs(clock.rate);
        const i = RATES.indexOf(curAbs);
        const j = Math.max(0, Math.min(RATES.length - 1, i + (e.key === "]" ? 1 : -1)));
        clock.rate = Math.sign(clock.rate || 1) * RATES[j];
        st.setClockMirror({ rate: clock.rate });
        sys("sys_clock_set", { rate: clock.rate });
      } else if (k === "r") {
        clock.rate = -clock.rate;
        st.setClockMirror({ rate: clock.rate });
        sys("sys_clock_set", { rate: clock.rate, action: "reverse" });
      } else if (k === "n") {
        clock.jumpToNow();
        st.setClockMirror({ displayTimeMs: clock.now(), rate: clock.rate, playing: clock.playing });
        sys("sys_clock_set", { action: "now" });
      } else if (k === "c") {
        st.toggleOverlay("constellations");
        sys("sys_display_set", { layer: "constellations" });
      } else if (k === "l") {
        st.toggleOverlay("labels");
        sys("sys_display_set", { layer: "labels" });
      } else if (k === "g") {
        st.toggleOverlay("gridAltAz");
        st.toggleOverlay("gridEquatorial");
        sys("sys_display_set", { layer: "grids" });
      } else if (k === "m") {
        st.toggleOverlay("nightMode");
        sys("sys_display_set", { layer: "nightMode" });
      } else if (k === "t") {
        st.toggleTracking();
        sys("sys_display_set", { tracking: String(!st.tracking) });
      } else if (e.key === "?") {
        e.preventDefault();
        st.setHelpOpen(!st.helpOpen);
      } else if (e.key === "/" && !st.searchOpen) {
        e.preventDefault();
        st.setSearchOpen(true);
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
