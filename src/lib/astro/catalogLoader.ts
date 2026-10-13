import type { ObjectKind, SkyObject } from "./types";

const D2R = Math.PI / 180;

export interface StarCatalogData {
  count: number;
  ids: string[];
  raDeg: Float32Array;
  decDeg: Float32Array;
  mag: Float32Array;
  bv: Float32Array;
  distLy: Float32Array; // -1 if null
  ux: Float32Array;
  uy: Float32Array;
  uz: Float32Array;
  names: string[];
  cons: string[];
  spects: string[];
  idToIndex: Map<string, number>;
}

export interface DeepSkyCatalogData {
  count: number;
  ids: string[];
  names: string[];
  types: string[];
  kinds: ObjectKind[];
  raDeg: Float32Array;
  decDeg: Float32Array;
  mag: Float32Array;
  sizArcmin: Float32Array;
  cons: string[];
  mNums: (number | null)[];
  ux: Float32Array;
  uy: Float32Array;
  uz: Float32Array;
  idToIndex: Map<string, number>;
}

export interface ConstellationLineData {
  con: string;
  segments: [number, number, number, number][];
}

export interface ConstellationLabelData {
  con: string;
  name: string;
  raDeg: number;
  decDeg: number;
}

export interface ConstellationsCatalogData {
  lines: ConstellationLineData[];
  labels: ConstellationLabelData[];
}

export interface ViewMatrix {
  rx0: number; rx1: number; rx2: number;
  ry0: number; ry1: number; ry2: number;
  rz0: number; rz1: number; rz2: number;
  m20: number; m21: number; m22: number;
}

// ── in-memory stores ──────────────────────────────────────────────────────────
let starCatalog: StarCatalogData | null = null;
let deepSkyCatalog: DeepSkyCatalogData | null = null;
let constellationsCatalog: ConstellationsCatalogData | null = null;
let aliasMap: Record<string, string> | null = null;
let xrefMap: Record<string, Record<string, string>> | null = null;

let cachedStarObjects: SkyObject[] | null = null;
let cachedDeepSkyObjects: SkyObject[] | null = null;

let isLoaded = false;
let loadPromise: Promise<void> | null = null;
let loadError: string | null = null;


/** Map OpenNGC type string to SkyObject kind. */
function dsoTypeToKind(type: string): ObjectKind {
  const t = type.toUpperCase();
  if (t === "G" || t.includes("GAL")) return "galaxy";
  if (t === "NB" || t === "NEB" || t === "SNR" || t === "HII" || t === "PN") return "nebula";
  if (t === "OC" || t === "GC" || t === "CL" || t.includes("CL")) return "cluster";
  return "other";
}

/** Compute view rotation matrix for the stereographic projection. */
export function computeViewMatrix(
  latDeg: number,
  lstDeg: number,
  viewAz: number,
  viewAlt: number,
): ViewMatrix {
  const phi = latDeg * D2R;
  const lst = lstDeg * D2R;
  const az0 = viewAz * D2R;
  const alt0 = viewAlt * D2R;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLst = Math.sin(lst);
  const cosLst = Math.cos(lst);

  // Meq_to_hz rows
  const m00 = -sinPhi * cosLst;
  const m01 = -sinPhi * sinLst;
  const m02 = cosPhi;

  const m10 = -sinLst;
  const m11 = cosLst;
  const m12 = 0;

  const m20 = cosPhi * cosLst;
  const m21 = cosPhi * sinLst;
  const m22 = sinPhi;

  // View frame in horizontal coords:
  // u (right): -sin(az0), cos(az0), 0
  // v (up): -sin(alt0)*cos(az0), -sin(alt0)*sin(az0), cos(alt0)
  // w (forward): cos(alt0)*cos(az0), cos(alt0)*sin(az0), sin(alt0)
  const sinAz0 = Math.sin(az0);
  const cosAz0 = Math.cos(az0);
  const sinAlt0 = Math.sin(alt0);
  const cosAlt0 = Math.cos(alt0);

  const ux = -sinAz0, uy = cosAz0, uz = 0;
  const vx = -sinAlt0 * cosAz0, vy = -sinAlt0 * sinAz0, vz = cosAlt0;
  const wx = cosAlt0 * cosAz0, wy = cosAlt0 * sinAz0, wz = sinAlt0;

  // Combined matrix rows: R_view = [u, v, w]^T * Meq_to_hz
  return {
    rx0: ux * m00 + uy * m10 + uz * m20,
    rx1: ux * m01 + uy * m11 + uz * m21,
    rx2: ux * m02 + uy * m12 + uz * m22,

    ry0: vx * m00 + vy * m10 + vz * m20,
    ry1: vx * m01 + vy * m11 + vz * m21,
    ry2: vx * m02 + vy * m12 + vz * m22,

    rz0: wx * m00 + wy * m10 + wz * m20,
    rz1: wx * m01 + wy * m11 + wz * m21,
    rz2: wx * m02 + wy * m12 + wz * m22,

    m20, m21, m22,
  };
}

/** Magnitude limit by FOV: 6.5 at fov >= 50°, scaling up to 9.0 at fov <= 5°. */
export function getMagLimitForFov(fovDeg: number): number {
  if (fovDeg >= 50) return 6.5;
  if (fovDeg <= 5) return 9.0;
  const t = (50 - fovDeg) / 45;
  return 6.5 + t * 2.5;
}

/** Binary search to find number of stars with mag <= magLimit. */
export function getStarCutoffIndex(magLimit: number): number {
  if (!starCatalog) return 0;
  const mags = starCatalog.mag;
  let lo = 0, hi = starCatalog.count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (mags[mid] <= magLimit) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** Fetch or read JSON helper that works in both browser and Node/tests. */
async function loadJson<T>(url: string, localFilePath: string): Promise<T> {
  if (typeof window !== "undefined" && typeof fetch === "function") {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.json();
  }
  // Node / test environment fallback
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const fullPath = resolve(process.cwd(), localFilePath);
  return JSON.parse(readFileSync(fullPath, "utf8"));
}

/** Ingest parsed raw stars JSON into typed arrays. */
function processStars(raw: {
  cols: string[];
  rows: (string | number | null)[][];
  names: string[];
  cons: string[];
}) {
  const count = raw.rows.length;
  const ids = new Array<string>(count);
  const raDeg = new Float32Array(count);
  const decDeg = new Float32Array(count);
  const mag = new Float32Array(count);
  const bv = new Float32Array(count);
  const distLy = new Float32Array(count);
  const ux = new Float32Array(count);
  const uy = new Float32Array(count);
  const uz = new Float32Array(count);
  const names = new Array<string>(count);
  const cons = new Array<string>(count);
  const spects = new Array<string>(count);
  const idToIndex = new Map<string, number>();

  for (let i = 0; i < count; i++) {
    const r = raw.rows[i];
    const id = r[0] as string;
    const ra = r[1] as number;
    const dec = r[2] as number;
    const m = r[3] as number;
    const b = r[4] as number;
    const dist = (r[5] as number | null) ?? -1;
    const spect = raw.names[r[6] as number] || "";
    const con = raw.cons[r[7] as number] || "";
    const name = raw.names[r[8] as number] || "";

    ids[i] = id;
    raDeg[i] = ra;
    decDeg[i] = dec;
    mag[i] = m;
    bv[i] = b;
    distLy[i] = dist;
    names[i] = name;
    cons[i] = con;
    spects[i] = spect;
    idToIndex.set(id, i);

    // Precompute J2000 unit vector
    const alpha = ra * D2R;
    const delta = dec * D2R;
    const cosDelta = Math.cos(delta);
    ux[i] = cosDelta * Math.cos(alpha);
    uy[i] = cosDelta * Math.sin(alpha);
    uz[i] = Math.sin(delta);
  }

  starCatalog = {
    count,
    ids,
    raDeg,
    decDeg,
    mag,
    bv,
    distLy,
    ux,
    uy,
    uz,
    names,
    cons,
    spects,
    idToIndex,
  };
}

/** Ingest parsed raw deep-sky JSON into typed arrays. */
function processDeepSky(raw: {
  cols: string[];
  rows: (string | number | null)[][];
  names: string[];
  cons: string[];
}) {
  const count = raw.rows.length;
  const ids = new Array<string>(count);
  const names = new Array<string>(count);
  const types = new Array<string>(count);
  const kinds = new Array<ObjectKind>(count);
  const raDeg = new Float32Array(count);
  const decDeg = new Float32Array(count);
  const mag = new Float32Array(count);
  const sizArcmin = new Float32Array(count);
  const cons = new Array<string>(count);
  const mNums = new Array<number | null>(count);
  const ux = new Float32Array(count);
  const uy = new Float32Array(count);
  const uz = new Float32Array(count);
  const idToIndex = new Map<string, number>();

  for (let i = 0; i < count; i++) {
    const r = raw.rows[i];
    const id = r[0] as string;
    const name = raw.names[r[1] as number] || id;
    const type = r[2] as string;
    const ra = r[3] as number;
    const dec = r[4] as number;
    const m = r[5] as number;
    const siz = r[6] as number;
    const con = raw.cons[r[7] as number] || "";
    const mNum = r[8] as number | null;

    ids[i] = id;
    names[i] = name;
    types[i] = type;
    kinds[i] = dsoTypeToKind(type);
    raDeg[i] = ra;
    decDeg[i] = dec;
    mag[i] = m;
    sizArcmin[i] = siz;
    cons[i] = con;
    mNums[i] = mNum;
    idToIndex.set(id, i);

    const alpha = ra * D2R;
    const delta = dec * D2R;
    const cosDelta = Math.cos(delta);
    ux[i] = cosDelta * Math.cos(alpha);
    uy[i] = cosDelta * Math.sin(alpha);
    uz[i] = Math.sin(delta);
  }

  deepSkyCatalog = {
    count,
    ids,
    names,
    types,
    kinds,
    raDeg,
    decDeg,
    mag,
    sizArcmin,
    cons,
    mNums,
    ux,
    uy,
    uz,
    idToIndex,
  };
}

/** Load all catalogs once in parallel. */
export async function loadCatalogs(): Promise<void> {
  if (isLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const [starsRaw, dsoRaw, conRaw, aliasesRaw, xrefRaw] = await Promise.all([
        loadJson<any>("/data/stars.json", "public/data/stars.json"),
        loadJson<any>("/data/deepsky.json", "public/data/deepsky.json"),
        loadJson<ConstellationsCatalogData>("/data/constellations.json", "public/data/constellations.json"),
        loadJson<Record<string, string>>("/data/aliases.json", "public/data/aliases.json"),
        loadJson<Record<string, Record<string, string>>>("/data/xref.json", "public/data/xref.json"),
      ]);

      processStars(starsRaw);
      processDeepSky(dsoRaw);
      constellationsCatalog = conRaw;
      aliasMap = aliasesRaw;
      xrefMap = xrefRaw;
      isLoaded = true;
      loadError = null;
    } catch (err: any) {
      loadError = err?.message || String(err);
      console.error("Failed to load astronomical catalog:", err);
      throw err;
    }
  })();

  return loadPromise;
}

export function getAliases(): Record<string, string> | null {
  return aliasMap;
}

export function getXref(): Record<string, Record<string, string>> | null {
  return xrefMap;
}

export function isCatalogLoaded(): boolean {
  return isLoaded;
}

export function catalogLoadError(): string | null {
  return loadError;
}

export function getStarCatalog(): StarCatalogData | null {
  return starCatalog;
}

export function getDeepSkyCatalog(): DeepSkyCatalogData | null {
  return deepSkyCatalog;
}

export function getConstellations(): ConstellationsCatalogData | null {
  return constellationsCatalog;
}

/** Get list of star SkyObjects (at least 9000 naked-eye stars, up to full catalog). */
export function getStars(): SkyObject[] {
  if (cachedStarObjects) return cachedStarObjects;
  if (!starCatalog) return [];

  const count = starCatalog.count;
  const list: SkyObject[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const id = starCatalog.ids[i];
    const name = starCatalog.names[i] || id;
    list[i] = {
      id,
      name,
      kind: "star",
      raDeg: starCatalog.raDeg[i],
      decDeg: starCatalog.decDeg[i],
      mag: starCatalog.mag[i],
      bv: starCatalog.bv[i],
      distanceLy: starCatalog.distLy[i] >= 0 ? starCatalog.distLy[i] : undefined,
      constellation: starCatalog.cons[i] || undefined,
      spectralClass: starCatalog.spects[i] || undefined,
    };
  }
  cachedStarObjects = list;
  return cachedStarObjects;
}

/** Get list of deep sky SkyObjects. */
export function getDeepSky(): SkyObject[] {
  if (cachedDeepSkyObjects) return cachedDeepSkyObjects;
  if (!deepSkyCatalog) return [];

  const count = deepSkyCatalog.count;
  const list: SkyObject[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const id = deepSkyCatalog.ids[i];
    const name = deepSkyCatalog.names[i];
    const mNum = deepSkyCatalog.mNums[i];
    const desigs: string[] = [];
    if (mNum !== null) desigs.push(`M ${mNum}`);
    if (id) desigs.push(id.toUpperCase().replace(":", " "));

    list[i] = {
      id,
      name,
      kind: deepSkyCatalog.kinds[i],
      raDeg: deepSkyCatalog.raDeg[i],
      decDeg: deepSkyCatalog.decDeg[i],
      mag: deepSkyCatalog.mag[i],
      constellation: deepSkyCatalog.cons[i] || undefined,
      designations: desigs,
    };
  }
  cachedDeepSkyObjects = list;
  return cachedDeepSkyObjects;
}

/** Find a star by id. */
export function findStar(id: string): SkyObject | undefined {
  if (!starCatalog) return undefined;
  const idx = starCatalog.idToIndex.get(id);
  if (idx === undefined) return undefined;
  const name = starCatalog.names[idx] || id;

  const desigs: string[] = [];
  if (id.startsWith("hip:")) desigs.push(`HIP ${id.slice(4)}`);
  else if (id.startsWith("hd:")) desigs.push(`HD ${id.slice(3)}`);
  else if (id.startsWith("hr:")) desigs.push(`HR ${id.slice(3)}`);

  return {
    id,
    name,
    kind: "star",
    raDeg: starCatalog.raDeg[idx],
    decDeg: starCatalog.decDeg[idx],
    mag: starCatalog.mag[idx],
    bv: starCatalog.bv[idx],
    distanceLy: starCatalog.distLy[idx] >= 0 ? starCatalog.distLy[idx] : undefined,
    constellation: starCatalog.cons[idx] || undefined,
    spectralClass: starCatalog.spects[idx] || undefined,
    designations: desigs.length ? desigs : undefined,
  };
}


/** Find a deep-sky object by id. */
export function findDeepSky(id: string): SkyObject | undefined {
  if (!deepSkyCatalog) return undefined;
  const idx = deepSkyCatalog.idToIndex.get(id);
  if (idx === undefined) return undefined;
  const name = deepSkyCatalog.names[idx];
  const mNum = deepSkyCatalog.mNums[idx];
  const desigs: string[] = [];
  if (mNum !== null) desigs.push(`M ${mNum}`);
  if (id) desigs.push(id.toUpperCase().replace(":", " "));
  return {
    id,
    name,
    kind: deepSkyCatalog.kinds[idx],
    raDeg: deepSkyCatalog.raDeg[idx],
    decDeg: deepSkyCatalog.decDeg[idx],
    mag: deepSkyCatalog.mag[idx],
    constellation: deepSkyCatalog.cons[idx] || undefined,
    designations: desigs,
  };
}

/** Fast O(1) object lookup in star and deep-sky catalogs. */
export function findCatalogObject(id: string): SkyObject | undefined {
  return findStar(id) ?? findDeepSky(id);
}
