// Time helpers. All internal time is UTC milliseconds since epoch.

export const J2000_JD = 2451545.0;

export function julianDate(ms: number): number {
  return ms / 86400000 + 2440587.5;
}

/** Greenwich Mean Sidereal Time in degrees [0, 360). Good to well under an arcminute for modern dates. */
export function gmstDeg(ms: number): number {
  const d = julianDate(ms) - J2000_JD;
  const g = 280.46061837 + 360.98564736629 * d;
  return ((g % 360) + 360) % 360;
}

/** Local Sidereal Time in degrees for an observer longitude (east positive). */
export function lstDeg(ms: number, lonDeg: number): number {
  return (((gmstDeg(ms) + lonDeg) % 360) + 360) % 360;
}

export function formatSimTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
}
