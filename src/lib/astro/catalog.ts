import type { Observer, SkyObject } from "./types";
import { DEMO_STARS } from "./demoStars";
import { solarSystemObjects } from "./bodies";
import { equatorialToHorizontal } from "./projection";
import { lstDeg } from "./time";

// TODO(agent): replace DEMO_STARS with the generated catalog loaded from /data/*.json (docs/04-data-pipeline.md).
export function getStars(): SkyObject[] {
  return DEMO_STARS;
}

export function getAllObjects(ms: number, obs: Observer): SkyObject[] {
  return [...getStars(), ...solarSystemObjects(ms, obs)];
}

export function findObject(id: string, ms: number, obs: Observer): SkyObject | undefined {
  return getAllObjects(ms, obs).find((o) => o.id === id);
}

export function horizontalOf(o: SkyObject, ms: number, obs: Observer) {
  return equatorialToHorizontal(o.raDeg, o.decDeg, obs.lat, lstDeg(ms, obs.lon));
}
