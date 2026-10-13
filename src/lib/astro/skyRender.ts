import * as Astronomy from "astronomy-engine";
import type { Observer, ViewState } from "./types";
import { equatorialToHorizontal, projectHorizontal } from "./projection";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const OBLIQUITY_DEG = 23.4392911; // J2000 Earth axial tilt

export const PLANET_STYLES: Record<string, { color: string; radius: number; border?: string }> = {
  "planet:mercury": { color: "#a8a8a8", radius: 3.5 }, // Grey
  "planet:venus":   { color: "#fff3b0", radius: 5.5, border: "#ffe082" }, // Pale yellow
  "planet:mars":    { color: "#ff5722", radius: 4.5, border: "#e64a19" }, // Orange-red
  "planet:jupiter": { color: "#d4a373", radius: 6.5, border: "#bc6c25" }, // Tan / ochre
  "planet:saturn":  { color: "#f4d06f", radius: 5.5, border: "#e0b034" }, // Gold
  "planet:uranus":  { color: "#4dd0e1", radius: 4.0 }, // Cyan
  "planet:neptune": { color: "#3f51b5", radius: 4.0 }, // Blue
};

/** Get live Sun horizontal position. */
export function getSunHorizontal(ms: number, obs: Observer): { altDeg: number; azDeg: number } {
  const date = new Date(ms);
  const observer = new Astronomy.Observer(obs.lat, obs.lon, obs.elevation);
  const eq = Astronomy.Equator(Astronomy.Body.Sun, date, observer, false, true);
  const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec, "normal");
  return { altDeg: hor.altitude, azDeg: hor.azimuth };
}

/**
 * Draw sky background gradient driven by Sun altitude.
 * - Below -18°: Night
 * - -18° to -12°: Astronomical twilight
 * - -12° to -6°: Nautical twilight
 * - -6° to 0°: Civil twilight
 * - > 0°: Daytime sky
 */
export function drawSkyBackground(
  ctx: CanvasRenderingContext2D,
  sunAltDeg: number,
  w: number,
  h: number,
  nightMode: boolean,
): { starAlpha: number } {
  if (nightMode) {
    ctx.fillStyle = "#080202";
    ctx.fillRect(0, 0, w, h);
    return { starAlpha: 1.0 };
  }

  if (sunAltDeg <= -18) {
    // Pure night
    ctx.fillStyle = "#02040a";
    ctx.fillRect(0, 0, w, h);
    return { starAlpha: 1.0 };
  }

  if (sunAltDeg <= -12) {
    // Astronomical twilight
    const t = (sunAltDeg + 18) / 6; // 0..1
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#030612");
    grad.addColorStop(1, `rgb(${3 + Math.round(t * 8)}, ${6 + Math.round(t * 12)}, ${18 + Math.round(t * 22)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return { starAlpha: 1.0 - t * 0.2 };
  }

  if (sunAltDeg <= -6) {
    // Nautical twilight
    const t = (sunAltDeg + 12) / 6; // 0..1
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#060f24");
    grad.addColorStop(1, `rgb(${11 + Math.round(t * 30)}, ${18 + Math.round(t * 28)}, ${40 + Math.round(t * 40)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return { starAlpha: 0.8 - t * 0.4 };
  }

  if (sunAltDeg <= 0) {
    // Civil twilight (sunset / dawn glow)
    const t = (sunAltDeg + 6) / 6; // 0..1
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgb(${12 + Math.round(t * 20)}, ${25 + Math.round(t * 40)}, ${60 + Math.round(t * 60)})`);
    grad.addColorStop(1, `rgb(${45 + Math.round(t * 70)}, ${40 + Math.round(t * 50)}, ${70 + Math.round(t * 40)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return { starAlpha: 0.4 - t * 0.35 };
  }

  // Daytime (sun above horizon)
  const t = Math.min(1, sunAltDeg / 30); // 0..1 up to 30°
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  const topR = Math.round(15 + t * 25);
  const topG = Math.round(55 + t * 50);
  const topB = Math.round(110 + t * 65);
  const botR = Math.round(60 + t * 60);
  const botG = Math.round(110 + t * 50);
  const botB = Math.round(175 + t * 45);
  grad.addColorStop(0, `rgb(${topR}, ${topG}, ${topB})`);
  grad.addColorStop(1, `rgb(${botR}, ${botG}, ${botB})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // In full daylight (sunAlt > 6°), stars are completely washed out
  const starAlpha = Math.max(0, 0.05 - (sunAltDeg / 6) * 0.05);
  return { starAlpha };
}

/** Draw dark ground fill below horizon when enabled. */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  view: ViewState,
  w: number,
  h: number,
  nightMode: boolean,
) {
  const pts: { x: number; y: number }[] = [];
  for (let az = 0; az <= 360; az += 5) {
    const p = projectHorizontal(0, az, view, w, h);
    if (p.visible) pts.push({ x: p.x, y: p.y });
  }

  if (pts.length > 1) {
    ctx.save();
    ctx.fillStyle = nightMode ? "#0d0404" : "#05090f";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    // Complete polygon around the bottom
    ctx.lineTo(w + 50, h + 50);
    ctx.lineTo(-50, h + 50);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Ecliptic line passing through the zodiac and planets. */
export function drawEcliptic(
  ctx: CanvasRenderingContext2D,
  observer: Observer,
  lstDeg: number,
  view: ViewState,
  w: number,
  h: number,
  nightMode: boolean,
) {
  const eps = OBLIQUITY_DEG * D2R;
  const sinEps = Math.sin(eps);
  const cosEps = Math.cos(eps);

  ctx.strokeStyle = nightMode ? "#5a2420" : "#7d6b38";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();

  let started = false;
  for (let lon = 0; lon <= 360; lon += 2) {
    const l = lon * D2R;
    const sinDec = sinEps * Math.sin(l);
    const decDeg = Math.asin(sinDec) * R2D;
    const raDeg = ((Math.atan2(cosEps * Math.sin(l), Math.cos(l)) * R2D) + 360) % 360;

    const hz = equatorialToHorizontal(raDeg, decDeg, observer.lat, lstDeg);
    const p  = projectHorizontal(hz.altDeg, hz.azDeg, view, w, h);
    if (!p.visible) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(p.x, p.y);
      started = true;
    } else {
      ctx.lineTo(p.x, p.y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Alt/Az and Equatorial grid lines at 15° spacing. */
export function drawGrids(
  ctx: CanvasRenderingContext2D,
  overlays: { gridAltAz: boolean; gridEquatorial: boolean },
  observer: Observer,
  lstDeg: number,
  view: ViewState,
  w: number,
  h: number,
  nightMode: boolean,
) {
  const strokeColor = nightMode ? "rgba(90, 30, 25, 0.45)" : "rgba(40, 70, 115, 0.45)";
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;

  // ── Alt/Az Grid ───────────────────────────────────────────────────────────
  if (overlays.gridAltAz) {
    // Altitude circles: 15, 30, 45, 60, 75
    for (let alt = 15; alt < 90; alt += 15) {
      ctx.beginPath();
      let started = false;
      for (let az = 0; az <= 360; az += 5) {
        const p = projectHorizontal(alt, az, view, w, h);
        if (!p.visible) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // Azimuth radials: every 30°
    for (let az = 0; az < 360; az += 30) {
      ctx.beginPath();
      let started = false;
      for (let alt = 0; alt <= 85; alt += 5) {
        const p = projectHorizontal(alt, az, view, w, h);
        if (!p.visible) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  // ── Equatorial Grid ───────────────────────────────────────────────────────
  if (overlays.gridEquatorial) {
    ctx.setLineDash([2, 4]);
    // Declination lines: -60, -30, 0, 30, 60
    for (let dec = -60; dec <= 60; dec += 30) {
      ctx.beginPath();
      let started = false;
      for (let ra = 0; ra <= 360; ra += 5) {
        const hz = equatorialToHorizontal(ra, dec, observer.lat, lstDeg);
        const p  = projectHorizontal(hz.altDeg, hz.azDeg, view, w, h);
        if (!p.visible) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // RA lines: every 30° (2 hours)
    for (let ra = 0; ra < 360; ra += 30) {
      ctx.beginPath();
      let started = false;
      for (let dec = -75; dec <= 75; dec += 5) {
        const hz = equatorialToHorizontal(ra, dec, observer.lat, lstDeg);
        const p  = projectHorizontal(hz.altDeg, hz.azDeg, view, w, h);
        if (!p.visible) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}

/** Render the Moon disc with illumination phase. */
export function drawMoon(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  r: number,
  date: Date,
  nightMode: boolean,
) {
  let fraction = 1.0;
  let phaseAngle = 180;
  try {
    const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
    fraction = illum.phase_fraction;
    phaseAngle = Astronomy.MoonPhase(date);
  } catch {
    // fallback
  }

  // Base dark moon circle
  ctx.save();
  ctx.fillStyle = nightMode ? "#2a0d0d" : "#1a2233";
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();

  // Lit portion
  ctx.fillStyle = nightMode ? "#ff8a7a" : "#f5f7fa";
  ctx.beginPath();
  // If near full moon (fraction > 0.95), full circle
  if (fraction > 0.95) {
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (fraction > 0.05) {
    // Waxing (phaseAngle 0..180) vs Waning (180..360)
    const isWaxing = phaseAngle < 180;
    // Draw lit hemisphere + inner curve
    const startAngle = isWaxing ? -Math.PI / 2 : Math.PI / 2;
    const endAngle = isWaxing ? Math.PI / 2 : (3 * Math.PI) / 2;
    ctx.arc(px, py, r, startAngle, endAngle);

    // Inner ellipse: x radius scales with cos(phaseAngle)
    const innerWidth = r * Math.cos(phaseAngle * D2R);
    ctx.ellipse(px, py, Math.abs(innerWidth), r, 0, endAngle, startAngle, innerWidth >= 0);
    ctx.fill();
  }

  // Subtle rim ring
  ctx.strokeStyle = nightMode ? "#5a1e1b" : "#4a5a78";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Render planet with distinct styling, colors, and Saturn's ring. */
export function drawPlanet(
  ctx: CanvasRenderingContext2D,
  id: string,
  px: number,
  py: number,
  nightMode: boolean,
) {
  const style = PLANET_STYLES[id] ?? { color: "#e0e0e0", radius: 4.0 };
  const r = style.radius;
  const col = nightMode ? "#ff8a7a" : style.color;

  ctx.save();

  // Saturn's ring
  if (id === "planet:saturn" && !nightMode) {
    ctx.strokeStyle = "#e8c872";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(px, py, r * 2.1, r * 0.7, -0.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Planet body
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();

  if (style.border && !nightMode) {
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}
