import Fuse from "fuse.js";
import type { SkyObject } from "@/lib/astro/types";
import { normalizeQuery, parseCatalogId } from "./normalize";
import { getAliases, getXref, findCatalogObject } from "@/lib/astro/catalogLoader";

export interface SearchIndex {
  search: (query: string, limit?: number) => SkyObject[];
}

/**
 * Binary search for the first index in `entries` whose key >= `prefix`.
 */
function lowerBound(entries: [string, string][], prefix: string): number {
  let lo = 0;
  let hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (entries[mid][0] < prefix) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Builds the search index according to docs/06-search-spec.md:
 *  1. Exact normalized alias lookup
 *  2. Catalog-id parse (HIP/HD/HR/GJ/M/NGC/IC) -> xref table
 *  3. Alias prefix match, ranked by magnitude (brighter first)
 *  4. Fuzzy (Fuse.js) fallback with threshold ~0.35 over named objects when steps 1-3 < 3 results
 */
export function buildSearchIndex(
  objects: SkyObject[],
  customAliases?: Record<string, string>,
  customXref?: Record<string, Record<string, string>>,
): SearchIndex {
  // 1. Build fast id -> SkyObject lookup map
  const objectMap = new Map<string, SkyObject>();
  for (const o of objects) {
    objectMap.set(o.id, o);
  }

  // 2. Prepare alias map and sorted entries for O(log N) prefix lookups
  const aliasData = customAliases ?? getAliases() ?? {};
  const xrefData = customXref ?? getXref() ?? { hip: {}, hd: {}, hr: {}, gj: {}, messier: {}, ngc: {}, ic: {} };

  // Combine aliases.json with names and designations from the objects list
  const combinedAliases = new Map<string, string>();
  for (const [k, id] of Object.entries(aliasData)) {
    combinedAliases.set(k, id);
  }
  for (const o of objects) {
    const normName = normalizeQuery(o.name);
    if (normName && !combinedAliases.has(normName)) combinedAliases.set(normName, o.id);
    if (o.designations) {
      for (const d of o.designations) {
        const normD = normalizeQuery(d);
        if (normD && !combinedAliases.has(normD)) combinedAliases.set(normD, o.id);
      }
    }
  }

  const sortedAliasEntries: [string, string][] = Array.from(combinedAliases.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  // 3. Prepare Fuse instance over named objects only (a few thousand, not all 100k)
  const namedObjects = objects.filter((o) => {
    if (o.kind === "sun" || o.kind === "moon" || o.kind === "planet") return true;
    if (o.name && !o.name.startsWith("HIP ") && !o.name.startsWith("HD ") && !o.name.startsWith("HR ")) return true;
    if (o.designations && o.designations.length > 0) return true;
    return false;
  });

  const fuse = new Fuse(namedObjects, {
    keys: [
      { name: "name", weight: 0.7 },
      { name: "designations", weight: 0.3 },
    ],
    threshold: 0.35,
    ignoreLocation: true,
  });

  const resolveObject = (id?: string): SkyObject | undefined => {
    if (!id) return undefined;
    const direct = objectMap.get(id);
    if (direct) return direct;
    return findCatalogObject(id);
  };

  return {
    search(query: string, limit = 8): SkyObject[] {
      const q = query.trim();
      if (!q) return [];

      const out: SkyObject[] = [];
      const seen = new Set<string>();

      const add = (obj?: SkyObject) => {
        if (obj && !seen.has(obj.id)) {
          seen.add(obj.id);
          out.push(obj);
        }
      };

      const addId = (id?: string) => {
        if (!id) return;
        const obj = resolveObject(id);
        if (obj) add(obj);
      };

      const norm = normalizeQuery(q);

      // Step 1: Exact normalized alias lookup
      if (norm) {
        const exactId = combinedAliases.get(norm);
        if (exactId) addId(exactId);
      }

      // Step 2: Catalog-id parse then xref.json lookup
      const cat = parseCatalogId(q);
      if (cat) {
        const numStr = String(cat.number);
        const catMap = xrefData[cat.catalog];
        if (catMap) {
          const directMatch = catMap[numStr];
          if (directMatch) addId(directMatch);
          else if (cat.catalog === "gj") {
            // GJ might be formatted as "Gl <num>", "GJ <num>", etc.
            const glMatch = catMap[`Gl ${cat.number}`] ?? catMap[`GJ ${cat.number}`];
            if (glMatch) addId(glMatch);
          }
        }
        // Also check alias with catalog prefix without spaces (e.g. m31, ngc224, hip32349)
        const catAlias = cat.catalog + numStr;
        if (combinedAliases.has(catAlias)) addId(combinedAliases.get(catAlias));
      }

      // Step 3: Alias prefix match, ranked by magnitude (brighter first)
      if (norm.length >= 2 && out.length < limit) {
        const startIdx = lowerBound(sortedAliasEntries, norm);
        const candidateObjects: SkyObject[] = [];
        const candidateSeen = new Set<string>();

        // Collect matching alias entries (up to 100 candidates to rank)
        for (let i = startIdx; i < sortedAliasEntries.length && candidateObjects.length < 100; i++) {
          const [key, id] = sortedAliasEntries[i];
          if (!key.startsWith(norm)) break;
          if (seen.has(id) || candidateSeen.has(id)) continue;

          candidateSeen.add(id);
          const obj = resolveObject(id);
          if (obj) candidateObjects.push(obj);
        }

        // Rank by magnitude (brighter first -> lower magnitude number)
        candidateObjects.sort((a, b) => a.mag - b.mag);

        for (const o of candidateObjects) {
          add(o);
          if (out.length >= limit) break;
        }
      }

      // Step 4: Fuzzy (Fuse.js) fallback when steps 1-3 yield fewer than 3 results
      if (out.length < 3) {
        const fuzzyResults = fuse.search(q, { limit });
        for (const r of fuzzyResults) {
          add(r.item);
          if (out.length >= limit) break;
        }
      }

      return out.slice(0, limit);
    },
  };
}
