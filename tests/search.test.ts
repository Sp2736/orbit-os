import { describe, it, expect, beforeAll } from "vitest";
import { loadCatalogs, isCatalogLoaded } from "@/lib/astro/catalogLoader";
import { getAllObjects } from "@/lib/astro/catalog";
import { buildSearchIndex, type SearchIndex } from "@/lib/search";

describe("Celestial Search Engine (docs/06-search-spec.md)", () => {
  let searchIndex: SearchIndex;

  beforeAll(async () => {
    await loadCatalogs();
    expect(isCatalogLoaded()).toBe(true);
    const objects = getAllObjects(Date.now(), { name: "Equator", lat: 0, lon: 0, elevation: 0 });
    searchIndex = buildSearchIndex(objects);

  });

  const testCases: [string, string][] = [
    // Sirius queries
    ["Sirius", "hip:32349"],
    ["sirius", "hip:32349"],
    ["SIRIUS", "hip:32349"],
    ["Dog Star", "hip:32349"],
    ["alpha canis majoris", "hip:32349"],
    ["α CMa", "hip:32349"],
    ["alp CMa", "hip:32349"],
    ["9 CMa", "hip:32349"],
    ["HIP 32349", "hip:32349"],
    ["hip32349", "hip:32349"],
    ["HD 48915", "hip:32349"],
    ["HR 2491", "hip:32349"],

    // Alpha Centauri / Toliman
    ["Alpha Centauri", "hip:71683"],
    ["α Cen", "hip:71683"],
    ["alp Cen", "hip:71683"],
    ["Rigil Kentaurus", "hip:71683"],
    ["Toliman", "hip:71681"],

    // Polaris
    ["Polaris", "hip:11767"],
    ["North Star", "hip:11767"],
    ["Pole Star", "hip:11767"],
    ["alpha ursae minoris", "hip:11767"],
    ["HIP 11767", "hip:11767"],

    // Betelgeuse
    ["Betelgeuse", "hip:27989"],
    ["Betelgeus", "hip:27989"], // fuzzy typo
    ["alpha orionis", "hip:27989"],
    ["HD 39801", "hip:27989"],

    // M31 Andromeda Galaxy
    ["M31", "messier:31"],
    ["NGC 224", "messier:31"],
    ["Andromeda Galaxy", "messier:31"],
    ["Andromeda", "messier:31"],

    // M42 Orion Nebula
    ["M42", "messier:42"],
    ["NGC 1976", "messier:42"],
    ["Orion Nebula", "messier:42"],

    // M45 Pleiades
    ["M45", "messier:45"],
    ["Pleiades", "messier:45"],
    ["Seven Sisters", "messier:45"],

    // M1 Crab Nebula
    ["M1", "messier:1"],
    ["NGC 1952", "messier:1"],
    ["Crab Nebula", "messier:1"],

    // Solar system bodies
    ["Mars", "planet:mars"],
    ["Moon", "moon"],
    ["Luna", "moon"],
    ["Sun", "sun"],
    ["Sol", "sun"],

    // Famous nearby stars
    ["61 Cygni", "hip:104214"],
    ["Barnard's Star", "hip:87937"],
    ["Proxima Centauri", "hip:70890"],
    ["Gliese 551", "hip:70890"],
    ["GJ 551", "hip:70890"],
  ];

  it.each(testCases)('query "%s" resolves to %s', (query, expectedId) => {
    const results = searchIndex.search(query, 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(expectedId);
  });

  it('query "asdfgh" returns empty results', () => {
    const results = searchIndex.search("asdfgh");
    expect(results).toEqual([]);
  });

  it("prefix search ranks brighter objects first", () => {
    // "betel" should return Betelgeuse (mag 0.45) first
    const results = searchIndex.search("betel");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("hip:27989");
  });
});
