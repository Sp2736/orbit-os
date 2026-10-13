/** Rough B-V colour index -> RGB string. Good enough for dots; refine in docs/07. */
export function bvToColor(bv = 0.6): string {
  const t = Math.max(-0.4, Math.min(2.0, bv));
  let r: number, g: number, b: number;
  if (t < 0) { r = 0.61 + 0.11 * (t + 0.4) / 0.4; g = 0.70 + 0.07 * (t + 0.4) / 0.4; b = 1.0; }
  else if (t < 0.4) { r = 0.83 + 0.17 * t / 0.4; g = 0.87 + 0.13 * t / 0.4; b = 1.0; }
  else if (t < 1.6) { r = 1.0; g = 1.0 - 0.35 * (t - 0.4) / 1.2; b = 1.0 - 0.7 * (t - 0.4) / 1.2; }
  else { r = 1.0; g = 0.65 - 0.2 * (t - 1.6) / 0.4; b = 0.3 - 0.1 * (t - 1.6) / 0.4; }
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}
