import type { SkyObject } from "./types";

// DEMO DATA ONLY. Replaced by the generated HYG catalog (see docs/04-data-pipeline.md).
// [name, raHours, decDeg, mag, bv]
const RAW: [string, number, number, number, number][] = [
  ["Sirius", 6.7525, -16.7161, -1.46, 0.0],
  ["Canopus", 6.3992, -52.6957, -0.74, 0.15],
  ["Arcturus", 14.261, 19.1824, -0.05, 1.23],
  ["Vega", 18.6156, 38.7837, 0.03, 0.0],
  ["Capella", 5.2782, 45.998, 0.08, 0.8],
  ["Rigel", 5.2423, -8.2016, 0.13, -0.03],
  ["Procyon", 7.655, 5.225, 0.34, 0.42],
  ["Betelgeuse", 5.9195, 7.4071, 0.42, 1.85],
  ["Altair", 19.8464, 8.8683, 0.76, 0.22],
  ["Aldebaran", 4.5987, 16.5093, 0.85, 1.54],
  ["Antares", 16.4901, -26.432, 1.06, 1.83],
  ["Spica", 13.4199, -11.1613, 0.97, -0.23],
  ["Pollux", 7.7553, 28.0262, 1.14, 1.0],
  ["Fomalhaut", 22.9608, -29.6222, 1.16, 0.09],
  ["Deneb", 20.6905, 45.2803, 1.25, 0.09],
  ["Regulus", 10.1395, 11.9672, 1.35, -0.11],
  ["Polaris", 2.5303, 89.2641, 1.98, 0.6],
  ["Dubhe", 11.0621, 61.7508, 1.79, 1.07],
  ["Merak", 11.0307, 56.3824, 2.37, -0.02],
  ["Phecda", 11.8972, 53.6948, 2.44, 0.0],
  ["Megrez", 12.2571, 57.0326, 3.31, 0.08],
  ["Alioth", 12.9004, 55.9598, 1.77, -0.02],
  ["Mizar", 13.3988, 54.9254, 2.23, 0.02],
  ["Alkaid", 13.7923, 49.3133, 1.86, -0.19],
];

export const DEMO_STARS: SkyObject[] = RAW.map(([name, raH, dec, mag, bv]) => ({
  id: `demo:${name.toLowerCase()}`,
  name,
  kind: "star",
  raDeg: raH * 15,
  decDeg: dec,
  mag,
  bv,
  designations: [name],
}));
