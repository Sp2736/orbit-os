import { describe, it, expect } from "vitest";
import { normalizeQuery, parseCatalogId } from "@/lib/search/normalize";

describe("normalizeQuery", () => {
  it("expands greek letters and abbreviations", () => {
    expect(normalizeQuery("α Cen")).toBe("alphacen");
    expect(normalizeQuery("alp Cen")).toBe("alphacen");
    expect(normalizeQuery("Alpha Centauri")).toBe("alphacentauri");
  });
  it("strips punctuation and case", () => {
    expect(normalizeQuery("  Barnard's Star ")).toBe("barnardsstar");
  });
});

describe("parseCatalogId", () => {
  it("parses common catalogs", () => {
    expect(parseCatalogId("HIP 32349")).toEqual({ catalog: "hip", number: 32349 });
    expect(parseCatalogId("m31")).toEqual({ catalog: "messier", number: 31 });
    expect(parseCatalogId("NGC224")).toEqual({ catalog: "ngc", number: 224 });
    expect(parseCatalogId("Gliese 551")).toEqual({ catalog: "gj", number: 551 });
  });
  it("returns null for plain names", () => {
    expect(parseCatalogId("Sirius")).toBeNull();
  });
});
