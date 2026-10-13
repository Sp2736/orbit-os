import { describe, it, expect } from "vitest";
import {
  parseCsvRow,
  parseSemiRow,
  parseRA,
  parseDec,
  parseRASex,
  parseDecSex,
  parseHygRow,
  parseNgcRow,
  buildAliases,
  normalizeQuery,
  // @ts-ignore
} from "../scripts/build-catalog.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── parseCsvRow ───────────────────────────────────────────────────────────────
describe("parseCsvRow", () => {
  it("splits a simple row", () => {
    expect(parseCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(parseCsvRow('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });
  it("trims fields", () => {
    expect(parseCsvRow(" a , b ")).toEqual(["a", "b"]);
  });
});

// ── parseSemiRow ──────────────────────────────────────────────────────────────
describe("parseSemiRow", () => {
  it("splits on semicolons", () => {
    expect(parseSemiRow("NGC0224;G;00 42 44")).toEqual(["NGC0224", "G", "00 42 44"]);
  });
});

// ── parseRA / parseDec ────────────────────────────────────────────────────────
describe("parseRA / parseDec (HYG decimal format)", () => {
  it("converts hours to degrees", () => {
    expect(parseRA("6.752479")).toBeCloseTo(101.287185, 4);
  });
  it("returns NaN for empty", () => {
    expect(parseRA("")).toBeNaN();
  });
  it("passes through declination unchanged", () => {
    expect(parseDec("-16.716116")).toBeCloseTo(-16.716116, 5);
  });
});

// ── parseRASex / parseDecSex ──────────────────────────────────────────────────
describe("parseRASex / parseDecSex (OpenNGC sexagesimal)", () => {
  it("parses Andromeda Galaxy RA", () => {
    // 00h 42m 44.33s  =  0 + 42/60 + 44.33/3600 hours  = 0.71231... hours → *15 = 10.685°
    expect(parseRASex("00 42 44.33")).toBeCloseTo(10.6847, 2);
  });
  it("parses positive declination", () => {
    expect(parseDecSex("+41 16 07.5")).toBeCloseTo(41.269, 2);
  });
  it("parses negative declination", () => {
    expect(parseDecSex("-02 24 00")).toBeCloseTo(-2.4, 3);
  });
  it("returns NaN for empty", () => {
    expect(parseRASex("")).toBeNaN();
  });
});

// ── parseHygRow ───────────────────────────────────────────────────────────────
describe("parseHygRow", () => {
  const fixtureLines = readFileSync(
    resolve(process.cwd(), "tests/fixtures/hyg-mini.csv"), "utf8"
  ).split("\n");
  const header = parseCsvRow(fixtureLines[0]);
  const hdr    = Object.fromEntries(header.map((c: string, i: number) => [c.trim(), i]));

  it("skips the Sun row (id 0)", () => {
    const cols = parseCsvRow(fixtureLines[1]); // Sol
    expect(parseHygRow(cols, hdr)).toBeNull();
  });

  it("parses Sirius correctly", () => {
    const cols = parseCsvRow(fixtureLines[2]);
    const row  = parseHygRow(cols, hdr);
    expect(row).not.toBeNull();
    expect(row!.id).toBe("hip:32349");
    expect(row!.proper).toBe("Sirius");
    expect(row!.raDeg).toBeCloseTo(101.287, 2);
    expect(row!.decDeg).toBeCloseTo(-16.716, 2);
    expect(row!.mag).toBeCloseTo(-1.46, 2);
    expect(row!.bv).toBeCloseTo(0.0, 2);
    expect(row!.hip).toBe(32349);
  });

  it("parses Polaris correctly", () => {
    const cols = parseCsvRow(fixtureLines[4]);
    const row  = parseHygRow(cols, hdr);
    expect(row!.id).toBe("hip:11767");
    expect(row!.proper).toBe("Polaris");
    expect(row!.con).toBe("UMi");
    expect(row!.distLy).toBeCloseTo(132.906 * 3.26156, 0);
  });
});

// ── parseNgcRow ───────────────────────────────────────────────────────────────
describe("parseNgcRow", () => {
  const fixtureLines = readFileSync(
    resolve(process.cwd(), "tests/fixtures/ngc-mini.csv"), "utf8"
  ).split("\n");
  const header = parseSemiRow(fixtureLines[0]);
  const hdr    = Object.fromEntries(header.map((c: string, i: number) => [c.trim(), i]));

  it("parses M31 Andromeda Galaxy", () => {
    const cols = parseSemiRow(fixtureLines[1]);
    const row  = parseNgcRow(cols, hdr);
    expect(row).not.toBeNull();
    expect(row!.id).toBe("messier:31");
    expect(row!.ngcNum).toBe(224);
    expect(row!.mNum).toBe(31);
    expect(row!.raDeg).toBeCloseTo(10.684, 1);
    expect(row!.decDeg).toBeCloseTo(41.269, 1);
    expect(row!.commonNames).toContain("Andromeda Galaxy");
  });

  it("parses M1 Crab Nebula", () => {
    const cols = parseSemiRow(fixtureLines[2]);
    const row  = parseNgcRow(cols, hdr);
    expect(row!.id).toBe("messier:1");
    expect(row!.commonNames).toContain("Crab Nebula");
  });

  it("returns null for rows without valid RA/Dec", () => {
    // IC0434 line has empty RA/Dec fields in our fixture
    // (IC434 has coords but we can force-test by using a blank line)
    expect(parseNgcRow(["", "", "", "", ""], { Name:0, Type:1, RA:2, Dec:3, MajAx:4, MinAx:5,
      PosAng:6, "B-Mag":7, "V-Mag":8, M:13, NGC:14, IC:15, "Common names":28, Const:31 })).toBeNull();
  });
});

// ── buildAliases ──────────────────────────────────────────────────────────────
describe("buildAliases", () => {
  const sirius = {
    id:"hip:32349", hip:32349, hd:48915, hr:2491, gl:"",
    proper:"Sirius", bayer:"alp", flam:"9", con:"CMa", spect:"A1V",
    raDeg:101.287, decDeg:-16.716, mag:-1.46, bv:0.0, distLy:8.6,
  };
  const m31 = {
    id:"messier:31", name:"Andromeda Galaxy", ngcNum:224, icNum:null, mNum:31,
    commonNames:["Andromeda Galaxy","Great Andromeda Nebula"], type:"G",
    raDeg:10.684, decDeg:41.269, mag:3.44, sizArcmin:192.4, con:"And",
  };

  const { aliases, xref } = buildAliases([sirius], [m31], {});

  it("resolves proper name alias", () => {
    expect(aliases[normalizeQuery("Sirius")]).toBe("hip:32349");
  });
  it("resolves HIP alias", () => {
    expect(aliases[normalizeQuery("HIP 32349")]).toBe("hip:32349");
  });
  it("resolves HD alias", () => {
    expect(aliases[normalizeQuery("HD 48915")]).toBe("hip:32349");
  });
  it("resolves Bayer abbreviation", () => {
    expect(aliases[normalizeQuery("alp CMa")]).toBe("hip:32349");
  });
  it("resolves Flamsteed", () => {
    expect(aliases[normalizeQuery("9 CMa")]).toBe("hip:32349");
  });
  it("resolves Messier number", () => {
    expect(aliases[normalizeQuery("M 31")]).toBe("messier:31");
  });
  it("resolves NGC number", () => {
    expect(aliases[normalizeQuery("NGC 224")]).toBe("messier:31");
  });
  it("resolves common name", () => {
    expect(aliases[normalizeQuery("Andromeda Galaxy")]).toBe("messier:31");
  });
  it("populates xref tables", () => {
    expect(xref.hip["32349"]).toBe("hip:32349");
    expect(xref.messier["31"]).toBe("messier:31");
    expect(xref.ngc["224"]).toBe("messier:31");
  });
});

// ── normalizeQuery parity ─────────────────────────────────────────────────────
describe("normalizeQuery in build script matches src/lib/search/normalize.ts", () => {
  it("α Cen → alphacen", () => expect(normalizeQuery("α Cen")).toBe("alphacen"));
  it("alp Cen → alphacen", () => expect(normalizeQuery("alp Cen")).toBe("alphacen"));
  it("Barnard's Star → barnardsstar", () => expect(normalizeQuery("Barnard's Star")).toBe("barnardsstar"));
  it("m31 → m31", () => expect(normalizeQuery("M31")).toBe("m31"));
});
