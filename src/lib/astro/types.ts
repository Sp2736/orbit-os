export type ObjectKind = "star" | "planet" | "sun" | "moon" | "galaxy" | "nebula" | "cluster" | "other";

export interface SkyObject {
  id: string;            // stable unique id, e.g. "hip:32349" or "planet:mars"
  name: string;          // display name
  kind: ObjectKind;
  raDeg: number;         // J2000 right ascension, degrees
  decDeg: number;        // J2000 declination, degrees
  mag: number;           // apparent visual magnitude
  bv?: number;           // B-V color index (stars)
  distanceLy?: number;
  constellation?: string;
  designations?: string[];
}

export interface Observer {
  name: string;
  lat: number;
  lon: number;
  elevation: number;
}

export interface ViewState {
  az: number;   // degrees, centre of view
  alt: number;  // degrees, centre of view
  fov: number;  // degrees, vertical field of view
}

export interface ProjectedPoint {
  x: number;
  y: number;
  visible: boolean;
  altDeg: number;
  azDeg: number;
}
