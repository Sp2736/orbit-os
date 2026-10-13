import * as Astronomy from "astronomy-engine";
import type { Observer, SkyObject } from "./types";

const BODIES: { id: string; name: string; body: Astronomy.Body; kind: SkyObject["kind"] }[] = [
  { id: "sun", name: "Sun", body: Astronomy.Body.Sun, kind: "sun" },
  { id: "moon", name: "Moon", body: Astronomy.Body.Moon, kind: "moon" },
  { id: "planet:mercury", name: "Mercury", body: Astronomy.Body.Mercury, kind: "planet" },
  { id: "planet:venus", name: "Venus", body: Astronomy.Body.Venus, kind: "planet" },
  { id: "planet:mars", name: "Mars", body: Astronomy.Body.Mars, kind: "planet" },
  { id: "planet:jupiter", name: "Jupiter", body: Astronomy.Body.Jupiter, kind: "planet" },
  { id: "planet:saturn", name: "Saturn", body: Astronomy.Body.Saturn, kind: "planet" },
  { id: "planet:uranus", name: "Uranus", body: Astronomy.Body.Uranus, kind: "planet" },
  { id: "planet:neptune", name: "Neptune", body: Astronomy.Body.Neptune, kind: "planet" },
];

/** Solar-system bodies at a simulated time, as J2000 RA/Dec. Recomputed every frame (only 9 bodies). */
export function solarSystemObjects(ms: number, obs: Observer): SkyObject[] {
  const date = new Date(ms);
  const observer = new Astronomy.Observer(obs.lat, obs.lon, obs.elevation);
  return BODIES.map((b) => {
    const eq = Astronomy.Equator(b.body, date, observer, false, true); // J2000, with aberration
    let mag = 0;
    try {
      mag = Astronomy.Illumination(b.body, date).mag;
    } catch {
      mag = 0;
    }
    return {
      id: b.id,
      name: b.name,
      kind: b.kind,
      raDeg: eq.ra * 15,
      decDeg: eq.dec,
      mag,
      distanceLy: eq.dist * 1.58125e-5, // AU -> light years
    };
  });
}
