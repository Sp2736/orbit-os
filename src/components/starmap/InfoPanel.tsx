"use client";

import { findObject, horizontalOf } from "@/lib/astro/catalog";
import { clock } from "@/lib/astro/clock";
import { useSkyStore } from "@/store/useSkyStore";

export default function InfoPanel() {
  const selectedId = useSkyStore((s) => s.selectedId);
  const observer = useSkyStore((s) => s.observer);
  useSkyStore((s) => s.displayTimeMs); // re-render at ~4 Hz so live alt/az updates
  const select = useSkyStore((s) => s.select);

  if (!selectedId) return null;
  const ms = clock.now();
  const o = findObject(selectedId, ms, observer);
  if (!o) return null;
  const hz = horizontalOf(o, ms, observer);

  const rows: [string, string][] = [
    ["Type", o.kind],
    ["Magnitude", o.mag.toFixed(2)],
    ["RA (J2000)", `${(o.raDeg / 15).toFixed(3)} h`],
    ["Dec (J2000)", `${o.decDeg.toFixed(3)}°`],
    ["Altitude", `${hz.altDeg.toFixed(2)}°`],
    ["Azimuth", `${hz.azDeg.toFixed(2)}°`],
  ];
  if (o.distanceLy !== undefined) rows.push(["Distance", `${o.distanceLy.toExponential(3)} ly`]);
  if (o.constellation) rows.push(["Constellation", o.constellation]);
  // TODO(agent): designations list, spectral class, rise/transit/set, description (docs/07-ui-spec.md)

  return (
    <aside className="panel">
      <h2>{o.name}</h2>
      <table><tbody>{rows.map(([k, v]) => (<tr key={k}><td>{k}</td><td>{v}</td></tr>))}</tbody></table>
      <p style={{ marginTop: 12 }}><button onClick={() => select(null)}>Close</button></p>
    </aside>
  );
}
