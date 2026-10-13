"use client";

import { useMemo, useState } from "react";
import * as Astronomy from "astronomy-engine";
import { findObject, horizontalOf } from "@/lib/astro/catalog";
import { clock } from "@/lib/astro/clock";
import { slew } from "@/lib/astro/slew";
import { bvToColor } from "@/lib/astro/color";
import { DESCRIPTIONS } from "@/data/descriptions";
import { ObjectImage } from "./ObjectImage";
import { useSkyStore } from "@/store/useSkyStore";
import type { SkyObject, Observer } from "@/lib/astro/types";


function formatRA(raDeg: number): string {
  const raHours = ((raDeg / 15) % 24 + 24) % 24;
  const h = Math.floor(raHours);
  const m = Math.floor((raHours - h) * 60);
  const s = ((raHours - h) * 60 - m) * 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${s.toFixed(1).padStart(4, "0")}s`;
}

function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? "-" : "+";
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d) * 60 - m) * 60;
  return `${sign}${String(d).padStart(2, "0")}° ${String(m).padStart(2, "0")}′ ${s.toFixed(1).padStart(4, "0")}″`;
}

function formatTimePair(d: Date | null): string {
  if (!d) return "--:--";
  const utc = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  const loc = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} loc`;
  return `${loc} (${utc})`;
}

function getMoonPhaseName(angleDeg: number): string {
  const a = ((angleDeg % 360) + 360) % 360;
  if (a < 22.5 || a >= 337.5) return "New Moon";
  if (a < 67.5) return "Waxing Crescent";
  if (a < 112.5) return "First Quarter";
  if (a < 157.5) return "Waxing Gibbous";
  if (a < 202.5) return "Full Moon";
  if (a < 247.5) return "Waning Gibbous";
  if (a < 292.5) return "Third Quarter";
  return "Waning Crescent";
}

function getRiseTransitSet(o: SkyObject, ms: number, obs: Observer) {
  const date = new Date(ms);
  const astronomyObs = new Astronomy.Observer(obs.lat, obs.lon, obs.elevation);

  let riseDate: Date | null = null;
  let setDate: Date | null = null;
  let transitDate: Date | null = null;

  try {
    if (o.id === "sun") {
      const r = Astronomy.SearchRiseSet(Astronomy.Body.Sun, astronomyObs, 1, date, 1);
      const s = Astronomy.SearchRiseSet(Astronomy.Body.Sun, astronomyObs, -1, date, 1);
      const t = Astronomy.SearchHourAngle(Astronomy.Body.Sun, astronomyObs, 0, date, 1);
      if (r) riseDate = r.date;
      if (s) setDate = s.date;
      if (t) transitDate = t.time.date;
    } else if (o.id === "moon") {
      const r = Astronomy.SearchRiseSet(Astronomy.Body.Moon, astronomyObs, 1, date, 1);
      const s = Astronomy.SearchRiseSet(Astronomy.Body.Moon, astronomyObs, -1, date, 1);
      const t = Astronomy.SearchHourAngle(Astronomy.Body.Moon, astronomyObs, 0, date, 1);
      if (r) riseDate = r.date;
      if (s) setDate = s.date;
      if (t) transitDate = t.time.date;
    } else if (o.id.startsWith("planet:")) {
      const pName = o.id.replace("planet:", "");
      const bodyMap: Record<string, Astronomy.Body> = {
        mercury: Astronomy.Body.Mercury,
        venus: Astronomy.Body.Venus,
        mars: Astronomy.Body.Mars,
        jupiter: Astronomy.Body.Jupiter,
        saturn: Astronomy.Body.Saturn,
        uranus: Astronomy.Body.Uranus,
        neptune: Astronomy.Body.Neptune,
      };
      const b = bodyMap[pName];
      if (b !== undefined) {
        const r = Astronomy.SearchRiseSet(b, astronomyObs, 1, date, 1);
        const s = Astronomy.SearchRiseSet(b, astronomyObs, -1, date, 1);
        const t = Astronomy.SearchHourAngle(b, astronomyObs, 0, date, 1);
        if (r) riseDate = r.date;
        if (s) setDate = s.date;
        if (t) transitDate = t.time.date;
      }
    } else {
      Astronomy.DefineStar(Astronomy.Body.Star1, o.raDeg / 15, o.decDeg, o.distanceLy ?? 1000);
      const r = Astronomy.SearchRiseSet(Astronomy.Body.Star1, astronomyObs, 1, date, 1);
      const s = Astronomy.SearchRiseSet(Astronomy.Body.Star1, astronomyObs, -1, date, 1);
      const t = Astronomy.SearchHourAngle(Astronomy.Body.Star1, astronomyObs, 0, date, 1);
      if (r) riseDate = r.date;
      if (s) setDate = s.date;
      if (t) transitDate = t.time.date;
    }
  } catch {
    // Circumpolar or ephemeris failure fallback
  }

  return { riseDate, setDate, transitDate };
}

export default function InfoPanel() {
  const selectedId = useSkyStore((s) => s.selectedId);
  const observer = useSkyStore((s) => s.observer);
  const tracking = useSkyStore((s) => s.tracking);
  const toggleTracking = useSkyStore((s) => s.toggleTracking);
  const select = useSkyStore((s) => s.select);
  const [copied, setCopied] = useState(false);

  // Re-render mirror hook (~4 Hz) so live Alt/Az updates smoothly
  useSkyStore((s) => s.displayTimeMs);

  if (!selectedId) return null;
  const ms = clock.now();
  const o = findObject(selectedId, ms, observer);
  if (!o) return null;

  const hz = horizontalOf(o, ms, observer);
  const isAboveHorizon = hz.altDeg >= 0;

  // Ephemeris times for today
  const { riseDate, setDate, transitDate } = getRiseTransitSet(o, ms, observer);

  // Absolute magnitude calculation for stars with distance data
  let absMagStr: string | null = null;
  if (o.distanceLy && o.distanceLy > 0) {
    const distPc = o.distanceLy / 3.261563777;
    const absMag = o.mag - 5 * (Math.log10(distPc) - 1);
    absMagStr = absMag.toFixed(2);
  }

  // Solar system metrics
  let moonPhaseStr: string | null = null;
  let moonIllumStr: string | null = null;
  let planetElongStr: string | null = null;
  if (o.id === "moon") {
    try {
      const d = new Date(ms);
      const angle = Astronomy.MoonPhase(d);
      moonPhaseStr = getMoonPhaseName(angle);
      const ill = Astronomy.Illumination(Astronomy.Body.Moon, d);
      moonIllumStr = `${(ill.phase_fraction * 100).toFixed(1)}%`;
    } catch {
      // ignore
    }
  } else if (o.id.startsWith("planet:")) {
    try {
      const d = new Date(ms);
      const pName = o.id.replace("planet:", "");
      const bodyMap: Record<string, Astronomy.Body> = {
        mercury: Astronomy.Body.Mercury,
        venus: Astronomy.Body.Venus,
        mars: Astronomy.Body.Mars,
        jupiter: Astronomy.Body.Jupiter,
        saturn: Astronomy.Body.Saturn,
        uranus: Astronomy.Body.Uranus,
        neptune: Astronomy.Body.Neptune,
      };
      const b = bodyMap[pName];
      if (b !== undefined) {
        const elong = Astronomy.Elongation(b, d);
        planetElongStr = `${elong.elongation.toFixed(1)}°`;
      }
    } catch {
      // ignore
    }
  }

  // Description text
  const description = DESCRIPTIONS[o.id];

  const handleCentre = () => {
    const st = useSkyStore.getState();
    const curHz = horizontalOf(o, clock.now(), observer);
    slew.start(st.view, { az: curHz.azDeg, alt: curHz.altDeg }, performance.now());
  };

  const handleCopy = () => {
    const text = [
      `Object: ${o.name}`,
      `Type: ${o.kind}`,
      `RA (J2000): ${formatRA(o.raDeg)}`,
      `Dec (J2000): ${formatDec(o.decDeg)}`,
      `Alt: ${hz.altDeg.toFixed(2)}°`,
      `Az: ${hz.azDeg.toFixed(2)}°`,
      `Mag: ${o.mag.toFixed(2)}`,
    ].join("\n");

    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className="panel" style={{ width: 330 }}>
      <div className="info-badge-row">
        <span
          className="search-badge"
          style={{
            background: "rgba(94, 200, 255, 0.15)",
            color: "#5ec8ff",
          }}
        >
          {o.kind.toUpperCase()}
        </span>
        {o.constellation && (
          <span className="search-badge" style={{ background: "rgba(111, 134, 173, 0.2)", color: "#cfe3ff" }}>
            {o.constellation}
          </span>
        )}
        <span className={`status-pill ${isAboveHorizon ? "up" : "down"}`}>
          {isAboveHorizon ? "ABOVE HORIZON" : "BELOW HORIZON"}
        </span>
      </div>

      <h2 style={{ wordBreak: "break-word" }}>{o.name}</h2>

      {o.designations && o.designations.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 8 }}>
          {o.designations.join(" · ")}
        </div>
      )}

      <ObjectImage id={o.id} object={o} />

      {description && <div className="info-desc">{description}</div>}


      <table>
        <tbody>
          <tr>
            <td>Magnitude</td>
            <td>
              {o.mag.toFixed(2)} {absMagStr !== null && <span className="dim">(Abs: {absMagStr})</span>}
            </td>
          </tr>

          {o.spectralClass && (
            <tr>
              <td>Spectral Class</td>
              <td>
                {o.bv !== undefined && (
                  <span
                    className="color-swatch"
                    style={{ background: bvToColor(o.bv) }}
                  />
                )}
                {o.spectralClass} {o.bv !== undefined && <span className="dim">(B-V: {o.bv.toFixed(2)})</span>}
              </td>
            </tr>
          )}

          {o.distanceLy !== undefined && (
            <tr>
              <td>Distance</td>
              <td>
                {o.distanceLy >= 1
                  ? `${o.distanceLy >= 1000 ? o.distanceLy.toLocaleString("en-US", { maximumFractionDigits: 1 }) : o.distanceLy.toFixed(2)} ly`
                  : `${(o.distanceLy / 1.58125e-5).toFixed(3)} AU`}
              </td>
            </tr>
          )}

          {moonPhaseStr && (
            <tr>
              <td>Lunar Phase</td>
              <td>
                {moonPhaseStr} {moonIllumStr && <span className="dim">({moonIllumStr})</span>}
              </td>
            </tr>
          )}

          {planetElongStr && (
            <tr>
              <td>Elongation</td>
              <td>{planetElongStr}</td>
            </tr>
          )}

          <tr>
            <td>RA (J2000)</td>
            <td>{formatRA(o.raDeg)}</td>
          </tr>

          <tr>
            <td>Dec (J2000)</td>
            <td>{formatDec(o.decDeg)}</td>
          </tr>

          <tr>
            <td>Altitude</td>
            <td style={{ color: isAboveHorizon ? "var(--text)" : "var(--warn)" }}>
              {hz.altDeg > 0 ? `+${hz.altDeg.toFixed(2)}°` : `${hz.altDeg.toFixed(2)}°`}
            </td>
          </tr>

          <tr>
            <td>Azimuth</td>
            <td>{hz.azDeg.toFixed(2)}°</td>
          </tr>

          <tr>
            <td>Rise</td>
            <td>{riseDate ? formatTimePair(riseDate) : <span className="dim">Circumpolar / None</span>}</td>
          </tr>

          <tr>
            <td>Transit</td>
            <td>{transitDate ? formatTimePair(transitDate) : <span className="dim">--:--</span>}</td>
          </tr>

          <tr>
            <td>Set</td>
            <td>{setDate ? formatTimePair(setDate) : <span className="dim">Circumpolar / None</span>}</td>
          </tr>
        </tbody>
      </table>

      {!isAboveHorizon && riseDate && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--warn)" }}>
          Notice: Object is below horizon; rises at {formatTimePair(riseDate)}.
        </div>
      )}

      <div className="info-actions">
        <button onClick={handleCentre}>Centre</button>
        <button
          onClick={toggleTracking}
          className={tracking ? "tracking-active" : ""}
        >
          {tracking ? "Tracking [ON]" : "Track"}
        </button>
        <button onClick={handleCopy}>{copied ? "Copied!" : "Copy Coords"}</button>
        <button onClick={() => select(null)}>Close</button>
      </div>
    </aside>
  );
}
