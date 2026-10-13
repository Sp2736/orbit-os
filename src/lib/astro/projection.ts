import type { ProjectedPoint, ViewState } from "./types";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Equatorial (J2000 RA/Dec) -> horizontal (alt/az) for a given Local Sidereal Time. Degrees in, degrees out. */
export function equatorialToHorizontal(raDeg: number, decDeg: number, latDeg: number, lstDegrees: number) {
  const ha = (lstDegrees - raDeg) * D2R;
  const dec = decDeg * D2R;
  const lat = latDeg * D2R;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  // azimuth measured from North through East
  const y = -Math.sin(ha) * Math.cos(dec);
  const x = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(ha);
  let az = Math.atan2(y, x) * R2D;
  az = (az + 360) % 360;
  return { altDeg: alt * R2D, azDeg: az };
}

/** Horizontal -> equatorial (inverse), used for "centre view on object" maths and tests. */
export function horizontalToEquatorial(altDeg: number, azDeg: number, latDeg: number, lstDegrees: number) {
  const alt = altDeg * D2R;
  const az = azDeg * D2R;
  const lat = latDeg * D2R;
  const sinDec = Math.sin(alt) * Math.sin(lat) + Math.cos(alt) * Math.cos(lat) * Math.cos(az);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const y = -Math.sin(az) * Math.cos(alt);
  const x = Math.sin(alt) * Math.cos(lat) - Math.cos(alt) * Math.sin(lat) * Math.cos(az);
  const ha = Math.atan2(y, x) * R2D;
  const ra = (((lstDegrees - ha) % 360) + 360) % 360;
  return { raDeg: ra, decDeg: dec * R2D };
}

/** Pixels per unit of stereographic plane so that `fov` degrees spans the canvas height. */
export function stereographicScale(heightPx: number, fovDeg: number): number {
  return heightPx / 2 / (2 * Math.tan((fovDeg * D2R) / 4));
}

/** Stereographic projection of a horizontal coordinate around the view centre. Larger azimuth appears to the right. */
export function projectHorizontal(
  altDeg: number,
  azDeg: number,
  view: ViewState,
  widthPx: number,
  heightPx: number,
): ProjectedPoint {
  const alt = altDeg * D2R;
  const alt0 = view.alt * D2R;
  const dAz = (azDeg - view.az) * D2R;
  const cosc = Math.sin(alt0) * Math.sin(alt) + Math.cos(alt0) * Math.cos(alt) * Math.cos(dAz);
  if (cosc <= -0.999) return { x: 0, y: 0, visible: false, altDeg, azDeg };
  const k = 2 / (1 + cosc);
  const px = k * Math.cos(alt) * Math.sin(dAz);
  const py = k * (Math.cos(alt0) * Math.sin(alt) - Math.sin(alt0) * Math.cos(alt) * Math.cos(dAz));
  const s = stereographicScale(heightPx, view.fov);
  const x = widthPx / 2 + px * s;
  const y = heightPx / 2 - py * s;
  const visible = x > -50 && x < widthPx + 50 && y > -50 && y < heightPx + 50;
  return { x, y, visible, altDeg, azDeg };
}
