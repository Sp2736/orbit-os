import type { Observer, SkyObject } from "./types";
import { solarSystemObjects } from "./bodies";
import { equatorialToHorizontal } from "./projection";
import { lstDeg } from "./time";
import { getStars, getDeepSky, findCatalogObject } from "./catalogLoader";

export { getStars, getDeepSky };

export function getAllObjects(ms: number, obs: Observer): SkyObject[] {
  return [...getStars(), ...getDeepSky(), ...solarSystemObjects(ms, obs)];
}

export function findObject(id: string, ms: number, obs: Observer): SkyObject | undefined {
  if (id.startsWith("planet:") || id === "sun" || id === "moon") {
    return solarSystemObjects(ms, obs).find((o) => o.id === id);
  }
  return findCatalogObject(id);
}

export function horizontalOf(o: SkyObject, ms: number, obs: Observer) {
  return equatorialToHorizontal(o.raDeg, o.decDeg, obs.lat, lstDeg(ms, obs.lon));
}
