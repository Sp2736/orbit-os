import type { Observer } from "@/lib/astro/types";

export const OBSERVER_PRESETS: Observer[] = [
  { name: "Vadodara, IN (Default)", lat: 22.3072, lon: 73.1812, elevation: 39 },
  { name: "Mumbai, IN", lat: 19.0760, lon: 72.8777, elevation: 14 },
  { name: "Greenwich, UK", lat: 51.4769, lon: 0.0000, elevation: 46 },
  { name: "Mauna Kea, HI", lat: 19.8207, lon: -155.4681, elevation: 4205 },
  { name: "Antarctic (South Pole)", lat: -90.0000, lon: 0.0000, elevation: 2835 },
  { name: "ISV Meridian (Orbit)", lat: 0.0000, lon: 0.0000, elevation: 400000 },
];
