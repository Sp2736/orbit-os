/**
 * scripts/build-catalog.mjs  –  Phase 2, task 2.1
 *
 * Converts raw source files from scripts/.cache/ into compact JSON under public/data/.
 * Run: npm run build:catalog
 * Flag: --if-missing  (skip if all outputs already exist, used by the prebuild hook)
 *
 * Inputs (place in scripts/.cache/, gitignored):
 *   hyg.csv                   HYG Database CSV  (github.com/astronexus/HYG-Database)
 *   openngc.csv               OpenNGC CSV        (github.com/mattiaverga/OpenNGC)
 *   constellations.lines.json d3-celestial GeoJSON (github.com/ofrohn/d3-celestial)
 *
 * Pure exported functions (parseCsvRow, parseSemiRow, parseRA, parseDec,
 * parseRASex, parseDecSex, parseHygRow, parseNgcRow, buildAliases,
 * normalizeQuery) are unit-tested in tests/catalog-pipeline.test.ts
 * without needing the input files.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname }   from "node:path";
import { fileURLToPath }      from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── paths ─────────────────────────────────────────────────────────────────────
const CACHE     = resolve(__dirname, ".cache");
const OUT_DIR   = resolve(__dirname, "..", "public", "data");
const EXTRA     = resolve(__dirname, "data", "extra-names.json");
const IN_HYG    = resolve(CACHE, "hyg.csv");
const IN_NGC    = resolve(CACHE, "openngc.csv");
const IN_CON    = resolve(CACHE, "constellations.lines.json");
const OUT_STARS = resolve(OUT_DIR, "stars.json");
const OUT_DSO   = resolve(OUT_DIR, "deepsky.json");
const OUT_ALIAS = resolve(OUT_DIR, "aliases.json");
const OUT_XREF  = resolve(OUT_DIR, "xref.json");
const OUT_CON   = resolve(OUT_DIR, "constellations.json");
const OUTPUTS   = [OUT_STARS, OUT_DSO, OUT_ALIAS, OUT_XREF, OUT_CON];

// Full IAU constellation name table
export const CON_NAMES = {
  And:"Andromeda",Ant:"Antlia",Aps:"Apus",Aql:"Aquila",Aqr:"Aquarius",Ara:"Ara",Ari:"Aries",
  Aur:"Auriga",Boo:"Boötes",Cae:"Caelum",Cam:"Camelopardalis",Cap:"Capricornus",Car:"Carina",
  Cas:"Cassiopeia",Cen:"Centaurus",Cep:"Cepheus",Cet:"Cetus",Cha:"Chamaeleon",Cir:"Circinus",
  CMa:"Canis Major",CMi:"Canis Minor",Cnc:"Cancer",Col:"Columba",Com:"Coma Berenices",
  CrA:"Corona Australis",CrB:"Corona Borealis",Crt:"Crater",Cru:"Crux",Crv:"Corvus",
  CVn:"Canes Venatici",Cyg:"Cygnus",Del:"Delphinus",Dor:"Dorado",Dra:"Draco",Equ:"Equuleus",
  Eri:"Eridanus",For:"Fornax",Gem:"Gemini",Gru:"Grus",Her:"Hercules",Hor:"Horologium",
  Hya:"Hydra",Hyi:"Hydrus",Ind:"Indus",Lac:"Lacerta",Leo:"Leo",Lep:"Lepus",Lib:"Libra",
  LMi:"Leo Minor",Lup:"Lupus",Lyn:"Lynx",Lyr:"Lyra",Men:"Mensa",Mic:"Microscopium",
  Mon:"Monoceros",Mus:"Musca",Nor:"Norma",Oct:"Octans",Oph:"Ophiuchus",Ori:"Orion",
  Pav:"Pavo",Peg:"Pegasus",Per:"Perseus",Phe:"Phoenix",Pic:"Pictor",PsA:"Piscis Austrinus",
  Psc:"Pisces",Pup:"Puppis",Pyx:"Pyxis",Ret:"Reticulum",Scl:"Sculptor",Sco:"Scorpius",
  Sct:"Scutum",Ser:"Serpens",Sex:"Sextans",Sge:"Sagitta",Sgr:"Sagittarius",Tau:"Taurus",
  Tel:"Telescopium",TrA:"Triangulum Australe",Tri:"Triangulum",Tuc:"Tucana",
  UMa:"Ursa Major",UMi:"Ursa Minor",Vel:"Vela",Vir:"Virgo",Vol:"Volans",Vul:"Vulpecula",
};

export const CON_GENITIVES = {
  And:"Andromedae",Ant:"Antliae",Aps:"Apodis",Aql:"Aquilae",Aqr:"Aquarii",Ara:"Arae",Ari:"Arietis",
  Aur:"Aurigae",Boo:"Boötis",Cae:"Caeli",Cam:"Camelopardalis",Cap:"Capricorni",Car:"Carinae",
  Cas:"Cassiopeiae",Cen:"Centauri",Cep:"Cephei",Cet:"Ceti",Cha:"Chamaeleontis",Cir:"Circini",
  CMa:"Canis Majoris",CMi:"Canis Minoris",Cnc:"Cancri",Col:"Columbae",Com:"Comae Berenices",
  CrA:"Coronae Australis",CrB:"Coronae Borealis",Crt:"Crateris",Cru:"Crucis",Crv:"Corvi",
  CVn:"Canum Venaticorum",Cyg:"Cygni",Del:"Delphini",Dor:"Doradus",Dra:"Draconis",Equ:"Equulei",
  Eri:"Eridani",For:"Fornacis",Gem:"Geminorum",Gru:"Gruis",Her:"Herculis",Hor:"Horologii",
  Hya:"Hydrae",Hyi:"Hydri",Ind:"Indi",Lac:"Lacertae",Leo:"Leonis",Lep:"Leporis",Lib:"Librae",
  LMi:"Leonis Minoris",Lup:"Lupi",Lyn:"Lyncis",Lyr:"Lyrae",Men:"Mensae",Mic:"Microscopii",
  Mon:"Monocerotis",Mus:"Muscae",Nor:"Normae",Oct:"Octantis",Oph:"Ophiuchi",Ori:"Orionis",
  Pav:"Pavonis",Peg:"Pegasi",Per:"Persei",Phe:"Phoenicis",Pic:"Pictoris",PsA:"Piscis Austrini",
  Psc:"Piscium",Pup:"Puppis",Pyx:"Pyxidis",Ret:"Reticuli",Scl:"Sculptoris",Sco:"Scorpii",
  Sct:"Scuti",Ser:"Serpentis",Sex:"Sextantis",Sge:"Sagittae",Sgr:"Sagittarii",Tau:"Tauri",
  Tel:"Telescopii",TrA:"Trianguli Australis",Tri:"Trianguli",Tuc:"Tucanae",
  UMa:"Ursae Majoris",UMi:"Ursae Minoris",Vel:"Velorum",Vir:"Virginis",Vol:"Volantis",Vul:"Vulpeculae",
};

// ═════════════════════════════════════════════════════════════════════════════
// PURE FUNCTIONS  (all exported for unit tests; no I/O, no process.exit)
// ═════════════════════════════════════════════════════════════════════════════

/** Split one CSV line respecting double-quoted fields. */
export function parseCsvRow(line) {
  const fields = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === "," && !inQ) { fields.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  fields.push(cur.trim());
  return fields;
}

/** Split one semicolon-delimited OpenNGC row. */
export function parseSemiRow(line) {
  return line.split(";").map((f) => f.trim());
}

/** Convert HYG RA (decimal hours) → degrees. */
export function parseRA(s) {
  const v = parseFloat(s);
  return isNaN(v) ? NaN : v * 15;
}

/** Parse HYG declination (already degrees, pass-through). */
export function parseDec(s) {
  return parseFloat(s);
}

/** Parse OpenNGC RA "HH MM SS.ss" or "HH:MM:SS.ss" → degrees. */
export function parseRASex(s) {
  if (!s || !s.trim()) return NaN;
  const p = s.trim().split(/[\s:]+/);
  if (p.length < 2) return NaN;
  return ((parseFloat(p[0]) || 0) + (parseFloat(p[1]) || 0) / 60 + (parseFloat(p[2] ?? "0") || 0) / 3600) * 15;
}

/** Parse OpenNGC Dec "+DD MM SS.s" or "+DD:MM:SS.s" → degrees. */
export function parseDecSex(s) {
  if (!s || !s.trim()) return NaN;
  const sign = s.trim().startsWith("-") ? -1 : 1;
  const p = s.trim().replace(/^[+-]/, "").split(/[\s:]+/);
  return sign * ((parseFloat(p[0]) || 0) + (parseFloat(p[1]) || 0) / 60 + (parseFloat(p[2] ?? "0") || 0) / 3600);
}

/**
 * Parse one HYG row (cols already split, hdr = {colName: index}).
 * Returns null for Sun (id 0) or rows with invalid RA/Dec.
 */
export function parseHygRow(cols, hdr) {
  const id = parseInt(cols[hdr["id"]] ?? "0", 10);
  if (id === 0) return null; // skip Sun row

  const hip    = (cols[hdr["hip"]]  ?? "").trim();
  const hd     = (cols[hdr["hd"]]   ?? "").trim();
  const hr     = (cols[hdr["hr"]]   ?? "").trim();
  const gl     = (cols[hdr["gl"]]   ?? "").trim();
  const proper = (cols[hdr["proper"]] ?? "").trim();
  const bayer  = (cols[hdr["bayer"]]  ?? "").trim();
  const flam   = (cols[hdr["flam"]]   ?? "").trim();
  const con    = (cols[hdr["con"]]    ?? "").trim();
  const spect  = (cols[hdr["spect"]]  ?? "").trim();

  const ra  = parseRA(cols[hdr["ra"]]  ?? "");
  const dec = parseDec(cols[hdr["dec"]] ?? "");
  if (isNaN(ra) || isNaN(dec)) return null;

  const mag    = parseFloat(cols[hdr["mag"]]    ?? "99") || 99;
  const absmag = parseFloat(cols[hdr["absmag"]] ?? "0")  || 0;
  const dist   = parseFloat(cols[hdr["dist"]]   ?? "0")  || 0;
  const bv     = parseFloat(cols[hdr["ci"]]     ?? "0")  || 0;
  const distLy = (dist > 0 && dist < 100000) ? dist * 3.26156 : null;

  const canonId = hip ? `hip:${hip}` : hd ? `hd:${hd}` : `hyg:${id}`;

  return {
    id: canonId,
    hip:  hip  ? parseInt(hip,  10) : null,
    hd:   hd   ? parseInt(hd,   10) : null,
    hr:   hr   ? parseInt(hr,   10) : null,
    gl,
    proper, bayer, flam, con, spect,
    raDeg: ra, decDeg: dec, mag, absmag, bv, distLy,
  };
}

/**
 * Parse one OpenNGC row. Returns null for rows without valid RA/Dec.
 */
export function parseNgcRow(cols, hdr) {
  const name   = (cols[hdr["Name"]]  ?? "").trim();
  const type   = (cols[hdr["Type"]]  ?? "").trim();
  const raStr  = cols[hdr["RA"]]  ?? "";
  const decStr = cols[hdr["Dec"]] ?? "";

  const ra  = parseRASex(raStr);
  const dec = parseDecSex(decStr);
  if (isNaN(ra) || isNaN(dec)) return null;

  const mag       = parseFloat(cols[hdr["V-Mag"]] || cols[hdr["B-Mag"]] || "99") || 99;
  const sizArcmin = parseFloat(cols[hdr["MajAx"]] ?? "0") || 0;
  const con       = (cols[hdr["Const"]] ?? "").trim();
  const m         = (cols[hdr["M"]]    ?? "").trim();
  const cnames    = (cols[hdr["Common names"]] ?? "").trim();
  const commonNames = cnames ? cnames.split(",").map((s) => s.trim()).filter(Boolean) : [];

  let canonId = "";
  if (m)                      { canonId = `messier:${parseInt(m, 10)}`; }
  else if (name.startsWith("NGC")) { canonId = `ngc:${parseInt(name.replace("NGC", ""), 10)}`; }
  else if (name.startsWith("IC"))  { canonId = `ic:${parseInt(name.replace("IC",  ""), 10)}`; }
  else return null;

  const ngcNum = name.startsWith("NGC") ? parseInt(name.replace("NGC", ""), 10) : null;
  const icNum  = name.startsWith("IC")  ? parseInt(name.replace("IC",  ""), 10) : null;
  const mNum   = m ? parseInt(m, 10) : null;
  const displayName = commonNames[0] || name;

  return { id: canonId, name: displayName, ngcNum, icNum, mNum, commonNames, type, raDeg: ra, decDeg: dec, mag, sizArcmin, con };
}

// normalizeQuery – mirrors src/lib/search/normalize.ts exactly.
// If that file changes its logic, this copy MUST be updated too.
const GREEK_MAP = {
  "α":"alpha","β":"beta","γ":"gamma","δ":"delta","ε":"epsilon","ζ":"zeta","η":"eta","θ":"theta",
  "ι":"iota","κ":"kappa","λ":"lambda","μ":"mu","ν":"nu","ξ":"xi","ο":"omicron","π":"pi",
  "ρ":"rho","σ":"sigma","τ":"tau","υ":"upsilon","φ":"phi","χ":"chi","ψ":"psi","ω":"omega",
};
const BAYER_MAP = {
  alp:"alpha",bet:"beta",gam:"gamma",del:"delta",eps:"epsilon",zet:"zeta",eta:"eta",the:"theta",
  iot:"iota",kap:"kappa",lam:"lambda",mu:"mu",nu:"nu",xi:"xi",omi:"omicron",pi:"pi",
  rho:"rho",sig:"sigma",tau:"tau",ups:"upsilon",phi:"phi",chi:"chi",psi:"psi",ome:"omega",
};
/** Mirrors src/lib/search/normalize.ts::normalizeQuery exactly. */
export function normalizeQuery(input) {
  let s = input.trim().toLowerCase();
  s = s.replace(/[α-ω]/g, (ch) => GREEK_MAP[ch] ?? ch);
  s = s.replace(/[^a-z0-9\s]/g, " ");
  const parts = s.split(/\s+/).filter(Boolean).map((p) => BAYER_MAP[p] ?? p);
  return parts.join("");
}

/**
 * Build alias and xref tables from parsed star/DSO arrays + extra-names object.
 * Pure function – all inputs are in-memory objects.
 */
export function buildAliases(stars, dsos, extra) {
  const aliases = {};
  const xref    = { hip:{}, hd:{}, hr:{}, gj:{}, messier:{}, ngc:{}, ic:{} };

  const add = (alias, id) => {
    const k = normalizeQuery(alias);
    if (k && !aliases[k]) aliases[k] = id;
  };

  for (const s of stars) {
    if (s.proper) add(s.proper, s.id);
    if (s.hip)    { add(`HIP ${s.hip}`, s.id); xref.hip[String(s.hip)] = s.id; }
    if (s.hd)     { add(`HD ${s.hd}`,  s.id);  xref.hd[String(s.hd)]  = s.id; }
    if (s.hr)     { add(`HR ${s.hr}`,  s.id);  xref.hr[String(s.hr)]  = s.id; }
    if (s.gl)     {
      add(`GJ ${s.gl}`, s.id);
      add(`Gliese ${s.gl}`, s.id);
      xref.gj[s.gl] = s.id;
      if (!s.gl.includes(".")) {
        const numMatch = s.gl.match(/\d+/);
        if (numMatch) {
          xref.gj[numMatch[0]] = s.id;
          add(`GJ ${numMatch[0]}`, s.id);
          add(`Gliese ${numMatch[0]}`, s.id);
        }
      }
    }


    if (s.bayer && s.con) {
      add(`${s.bayer} ${s.con}`, s.id);
      const full = CON_NAMES[s.con] || s.con;
      add(`${s.bayer} ${full}`, s.id);
      const gen = CON_GENITIVES[s.con];
      if (gen) add(`${s.bayer} ${gen}`, s.id);
    }
    if (s.flam && s.con) {
      add(`${s.flam} ${s.con}`, s.id);
      const full = CON_NAMES[s.con] || s.con;
      add(`${s.flam} ${full}`, s.id);
      const gen = CON_GENITIVES[s.con];
      if (gen) add(`${s.flam} ${gen}`, s.id);
    }
  }

  for (const d of dsos) {
    add(d.name, d.id);
    for (const cn of (d.commonNames || [])) add(cn, d.id);
    if (d.mNum   !== null) { add(`M ${d.mNum}`,    d.id); xref.messier[String(d.mNum)]  = d.id; }
    if (d.ngcNum !== null) { add(`NGC ${d.ngcNum}`, d.id); xref.ngc[String(d.ngcNum)]   = d.id; }
    if (d.icNum  !== null) { add(`IC ${d.icNum}`,   d.id); xref.ic[String(d.icNum)]     = d.id; }
  }

  for (const [k, id] of Object.entries(extra)) {
    if (!k.startsWith("_")) {
      aliases[k] = id;
      if (k.startsWith("gj") || k.startsWith("gliese")) {
        const num = k.replace(/^(?:gj|gliese)/, "");
        if (/^\d+$/.test(num)) xref.gj[num] = id;
      }
    }
  }


  return { aliases, xref };
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PIPELINE  (runs only when script is executed directly, not on import)
// ═════════════════════════════════════════════════════════════════════════════
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (IS_MAIN) {
  // CLI flag
  const IF_MISSING = process.argv.includes("--if-missing");
  if (IF_MISSING && OUTPUTS.every(existsSync)) {
    console.log("build-catalog: all outputs present, skipping (--if-missing).");
    process.exit(0);
  }

  // Check inputs
  const requireInput = (filePath, url) => {
    if (!existsSync(filePath)) {
      console.error(`\nbuild-catalog: missing input: ${filePath}`);
      console.error(`  Download from: ${url}`);
      console.error(`  Place it at:   ${filePath}\n`);
      process.exit(1);
    }
  };
  requireInput(IN_HYG, "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv");
  requireInput(IN_NGC, "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv");
  requireInput(IN_CON, "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json");
  mkdirSync(OUT_DIR, { recursive: true });

  // ── stars ──────────────────────────────────────────────────────────────────
  console.log("build-catalog: reading HYG star database…");
  const hygLines  = readFileSync(IN_HYG, "utf8").split("\n");
  const hygHeader = parseCsvRow(hygLines[0]);
  const hygHdr    = Object.fromEntries(hygHeader.map((c, i) => [c.trim(), i]));
  const stars     = [];
  const extraObj  = existsSync(EXTRA) ? JSON.parse(readFileSync(EXTRA, "utf8")) : {};
  const extraIds  = new Set(Object.values(extraObj));
  for (let i = 1; i < hygLines.length; i++) {
    const line = hygLines[i].trim();
    if (!line) continue;
    const row = parseHygRow(parseCsvRow(line), hygHdr);
    if (row && (row.mag <= 9.0 || Boolean(row.proper) || extraIds.has(row.id))) stars.push(row);
  }
  stars.sort((a, b) => a.mag - b.mag);
  console.log(`  → ${stars.length} stars (mag ≤ 9.0 + named stars)`);


  // String-intern for compact JSON
  const nameIntern = [], nameIdx = new Map();
  const consIntern = [], conIdx  = new Map();
  const addName = (n) => { if (!nameIdx.has(n)) { nameIdx.set(n, nameIntern.length); nameIntern.push(n); } return nameIdx.get(n); };
  const addCon  = (c) => { if (!conIdx.has(c))  { conIdx.set(c, consIntern.length);  consIntern.push(c); } return conIdx.get(c); };

  const starRows = stars.map((s) => [
    s.id,
    +s.raDeg.toFixed(6), +s.decDeg.toFixed(6), +s.mag.toFixed(2), +s.bv.toFixed(3),
    s.distLy !== null ? +s.distLy.toFixed(2) : null,
    addName(s.spect || ""), addCon(s.con || ""), addName(s.proper || ""),
  ]);
  const starsJson = { cols:["id","raDeg","decDeg","mag","bv","distLy","spectIdx","conIdx","nameIdx"], rows:starRows, names:nameIntern, cons:consIntern };
  writeFileSync(OUT_STARS, JSON.stringify(starsJson));
  console.log(`  → stars.json  (${(JSON.stringify(starsJson).length/1024).toFixed(0)} KB)`);

  // ── deep-sky ───────────────────────────────────────────────────────────────
  console.log("build-catalog: reading OpenNGC deep-sky catalog…");
  const ngcLines  = readFileSync(IN_NGC, "utf8").split("\n");
  const ngcHeader = parseSemiRow(ngcLines[0]);
  const ngcHdr    = Object.fromEntries(ngcHeader.map((c, i) => [c.trim(), i]));
  const dsos      = [];
  for (let i = 1; i < ngcLines.length; i++) {
    const line = ngcLines[i].trim();
    if (!line) continue;
    const row = parseNgcRow(parseSemiRow(line), ngcHdr);
    if (row) dsos.push(row);
  }
  const knownMessierExtras = [
    { id: "messier:45", name: "Pleiades", ngcNum: null, icNum: null, mNum: 45, commonNames: ["Pleiades", "Seven Sisters"], type: "OC", raDeg: 56.85, decDeg: 24.1167, mag: 1.6, sizArcmin: 110, con: "Tau" },
    { id: "messier:40", name: "Winnecke 4", ngcNum: null, icNum: null, mNum: 40, commonNames: ["Winnecke 4"], type: "*", raDeg: 185.552, decDeg: 58.083, mag: 9.6, sizArcmin: 0.8, con: "UMa" },
  ];
  for (const extraDso of knownMessierExtras) {
    if (!dsos.some((d) => d.mNum === extraDso.mNum)) dsos.push(extraDso);
  }
  console.log(`  → ${dsos.length} deep-sky objects`);


  const dsoRows = dsos.map((d) => [
    d.id, addName(d.name || ""), d.type,
    +d.raDeg.toFixed(6), +d.decDeg.toFixed(6), +d.mag.toFixed(2), +d.sizArcmin.toFixed(2),
    addCon(d.con || ""), d.mNum,
  ]);
  const dsJson = { cols:["id","nameIdx","type","raDeg","decDeg","mag","sizArcmin","conIdx","mNum"], rows:dsoRows, names:nameIntern, cons:consIntern };
  writeFileSync(OUT_DSO, JSON.stringify(dsJson));
  console.log(`  → deepsky.json  (${(JSON.stringify(dsJson).length/1024).toFixed(0)} KB)`);

  // ── aliases + xref ─────────────────────────────────────────────────────────
  console.log("build-catalog: building alias index…");
  const extra = JSON.parse(readFileSync(EXTRA, "utf8"));
  const { aliases, xref } = buildAliases(stars, dsos, extra);
  writeFileSync(OUT_ALIAS, JSON.stringify(aliases));
  writeFileSync(OUT_XREF,  JSON.stringify(xref));
  console.log(`  → aliases.json  (${Object.keys(aliases).length} entries)`);
  console.log(`  → xref.json`);

  // ── constellation lines ────────────────────────────────────────────────────
  console.log("build-catalog: reading constellation lines…");
  const conRaw    = JSON.parse(readFileSync(IN_CON, "utf8"));
  const conLines  = [];
  const conLabels = [];

  for (const feature of (conRaw.features ?? [])) {
    const con  = feature.id ?? feature.properties?.id ?? "";
    const geom = feature.geometry;
    if (!con || !geom) continue;

    const segs = [];
    const addSeg = (coords) => {
      for (let i = 0; i + 1 < coords.length; i++) {
        const [ra1, dec1] = coords[i];
        const [ra2, dec2] = coords[i + 1];
        segs.push([
          +((ra1 % 360 + 360) % 360).toFixed(4), +dec1.toFixed(4),
          +((ra2 % 360 + 360) % 360).toFixed(4), +dec2.toFixed(4),
        ]);
      }
    };
    if      (geom.type === "MultiLineString") for (const l of geom.coordinates) addSeg(l);
    else if (geom.type === "LineString")      addSeg(geom.coordinates);

    if (segs.length) {
      conLines.push({ con, segments: segs });
      const s = segs[Math.floor(segs.length / 2)];
      conLabels.push({ con, name: CON_NAMES[con] || con, raDeg: +((s[0]+s[2])/2).toFixed(4), decDeg: +((s[1]+s[3])/2).toFixed(4) });
    }
  }

  const conJson = { lines: conLines, labels: conLabels };
  writeFileSync(OUT_CON, JSON.stringify(conJson));
  console.log(`  → constellations.json  (${conLines.length} constellations)`);

  // ── summary ────────────────────────────────────────────────────────────────
  console.log("\nbuild-catalog: done.");
  console.log(`  stars:      ${stars.length}`);
  console.log(`  deep-sky:   ${dsos.length}`);
  console.log(`  aliases:    ${Object.keys(aliases).length}`);
  console.log(`  con lines:  ${conLines.length}`);
}
