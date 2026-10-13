"use client";

import { useEffect, useMemo, useState } from "react";
import { useSkyStore } from "@/store/useSkyStore";
import { getXref } from "@/lib/astro/catalogLoader";
import type { SkyObject } from "@/lib/astro/types";

export interface ObjectImageProps {
  id: string;
  size?: number;
  object?: SkyObject;
}

// In-memory cache for urls.json
let cachedUrls: Record<string, { image: string; thumb: string }> | null = null;
let fetchPromise: Promise<Record<string, { image: string; thumb: string }>> | null = null;

async function getUrlsMap(): Promise<Record<string, { image: string; thumb: string }>> {
  if (cachedUrls) return cachedUrls;
  if (!fetchPromise) {
    fetchPromise = (async () => {
      try {
        if (typeof window !== "undefined") {
          const res = await fetch("/data/urls.json");
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          cachedUrls = data.objects || {};
          return cachedUrls!;
        }
        const { readFileSync } = await import("node:fs");
        const { resolve } = await import("node:path");
        const fullPath = resolve(process.cwd(), "public/data/urls.json");
        const data = JSON.parse(readFileSync(fullPath, "utf8"));
        cachedUrls = data.objects || {};
        return cachedUrls!;
      } catch (err) {
        console.warn("Could not load celestial imagery catalog:", err);
        cachedUrls = {};
        return cachedUrls;
      }
    })();
  }
  return fetchPromise;
}

// Local bundled assets + verified public telemetry fallbacks for Solar System bodies
const SOLAR_SYSTEM_IMAGES: Record<
  string,
  { local: string; fallback: string; source: string }
> = {
  sun: {
    local: "/images/bodies/sun.jpg",
    fallback:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg/500px-The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg",
    source: "NASA SDO / AIA",
  },
  moon: {
    local: "/images/bodies/moon.jpg",
    fallback:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/500px-FullMoon2010.jpg",
    source: "NASA / GSFC / LRO",
  },
  "planet:mercury": {
    local: "/images/bodies/mercury.jpg",
    fallback:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Mercury_in_true_color.jpg/500px-Mercury_in_true_color.jpg",
    source: "NASA / JHUAPL / MESSENGER",
  },
  "planet:venus": {
    local: "/images/bodies/venus.jpg",
    fallback:
      "https://upload.wikimedia.org/wikipedia/commons/0/08/Venus_from_Mariner_10.jpg",
    source: "NASA / Mariner 10",
  },
  "planet:mars": {
    local: "/images/bodies/mars.jpg",
    fallback:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/OSIRIS_Mars_true_color.jpg/500px-OSIRIS_Mars_true_color.jpg",
    source: "ESA / OSIRIS / NASA",
  },
  "planet:jupiter": {
    local: "/images/bodies/jupiter.jpg",
    fallback:
      "https://upload.wikimedia.org/wikipedia/commons/e/e2/Jupiter.jpg",
    source: "NASA / JPL / Cassini",
  },
  "planet:saturn": {
    local: "/images/bodies/saturn.jpg",
    fallback:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/Saturn_during_Equinox.jpg/500px-Saturn_during_Equinox.jpg",
    source: "NASA / JPL / Cassini",
  },
  "planet:uranus": {
    local: "/images/bodies/uranus.jpg",
    fallback:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Uranus_Voyager2_color_calibrated.png/500px-Uranus_Voyager2_color_calibrated.png",
    source: "NASA / JPL / Voyager 2",
  },
  "planet:neptune": {
    local: "/images/bodies/neptune.jpg",
    fallback:
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Neptune_Voyager2_color_calibrated.png/500px-Neptune_Voyager2_color_calibrated.png",
    source: "NASA / JPL / Voyager 2",
  },
};

/** Ensure hips2fits parameters are valid (rewrite coordinates to ra/dec if present). */
function sanitizeHipsUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const u = new URL(rawUrl);
    const coords = u.searchParams.get("coordinates");
    if (coords) {
      const [ra, dec] = coords.split(",");
      u.searchParams.delete("coordinates");
      u.searchParams.set("ra", ra);
      u.searchParams.set("dec", dec);
      return u.toString();
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

/** Construct dynamic DSS2 cutout URL for any celestial coordinates. */
function dynamicDss2Url(raDeg: number, decDeg: number, fov = 0.2, px = 512): string {
  return `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=CDS%2FP%2FDSS2%2Fcolor&width=${px}&height=${px}&fov=${fov}&projection=TAN&ra=${raDeg.toFixed(5)}&dec=${decDeg.toFixed(5)}&format=jpg`;
}

/** Construct dynamic 2MASS infrared cutout URL as a secondary celestial fallback. */
function dynamic2MassUrl(raDeg: number, decDeg: number, fov = 0.2, px = 512): string {
  return `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=CDS%2FP%2F2MASS%2Fcolor&width=${px}&height=${px}&fov=${fov}&projection=TAN&ra=${raDeg.toFixed(5)}&dec=${decDeg.toFixed(5)}&format=jpg`;
}

interface ImageCandidate {
  url: string;
  source: string;
}

/** Resolve prioritized list of candidate image URLs for any celestial object. */
function getCandidates(
  id: string,
  object?: SkyObject,
  urlsMap: Record<string, { image: string; thumb: string }> = {}
): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];

  // 1. Solar System bodies
  const solar = SOLAR_SYSTEM_IMAGES[id];
  if (solar) {
    if (solar.local) {
      candidates.push({ url: solar.local, source: `${solar.source} (Telemetry)` });
    }
    if (solar.fallback) {
      candidates.push({ url: solar.fallback, source: solar.source });
    }
    return candidates;
  }

  // 2. Direct hit in urls.json catalog
  const directEntry = urlsMap[id];
  if (directEntry?.image) {
    candidates.push({
      url: sanitizeHipsUrl(directEntry.image),
      source: "CDS Strasbourg / DSS2 Survey",
    });
  }

  // 3. Cross-reference lookup (e.g. ngc:4594 -> messier:104, messier:31 -> ngc:224)
  const xref = getXref();
  if (xref) {
    let crossId: string | undefined;
    if (id.startsWith("ngc:")) {
      crossId = xref.ngc?.[id.slice(4)];
    } else if (id.startsWith("messier:")) {
      crossId = xref.messier?.[id.slice(8)];
    } else if (id.startsWith("ic:")) {
      crossId = xref.ic?.[id.slice(3)];
    }
    if (crossId && urlsMap[crossId]?.image) {
      candidates.push({
        url: sanitizeHipsUrl(urlsMap[crossId].image),
        source: "CDS Strasbourg / DSS2 Survey",
      });
    }
  }

  // 4. Designations lookup (e.g. "M 104" or "NGC 4594" in object.designations)
  if (object?.designations) {
    for (const d of object.designations) {
      const trimmed = d.trim().toLowerCase();
      const mMatch = trimmed.match(/^m\s*(\d+)$/);
      if (mMatch) {
        const mKey = `messier:${mMatch[1]}`;
        if (urlsMap[mKey]?.image) {
          candidates.push({
            url: sanitizeHipsUrl(urlsMap[mKey].image),
            source: "CDS Strasbourg / DSS2 Survey",
          });
        }
      }
      const ngcMatch = trimmed.match(/^ngc\s*(\d+)$/);
      if (ngcMatch) {
        const ngcKey = `ngc:${ngcMatch[1]}`;
        if (urlsMap[ngcKey]?.image) {
          candidates.push({
            url: sanitizeHipsUrl(urlsMap[ngcKey].image),
            source: "CDS Strasbourg / DSS2 Survey",
          });
        }
      }
      const icMatch = trimmed.match(/^ic\s*(\d+)$/);
      if (icMatch) {
        const icKey = `ic:${icMatch[1]}`;
        if (urlsMap[icKey]?.image) {
          candidates.push({
            url: sanitizeHipsUrl(urlsMap[icKey].image),
            source: "CDS Strasbourg / DSS2 Survey",
          });
        }
      }
    }
  }

  // 5. Dynamic Cutouts for ANY celestial object with coordinates (stars, DSOs, etc.)
  if (object && !isNaN(object.raDeg) && !isNaN(object.decDeg)) {
    const isStar = object.kind === "star";
    const fov = isStar ? 0.15 : 0.35;

    // Primary dynamic cutout: DSS2 color survey
    candidates.push({
      url: dynamicDss2Url(object.raDeg, object.decDeg, fov),
      source: isStar ? "CDS Strasbourg / DSS2 Optical" : "CDS Strasbourg / DSS2 Survey",
    });

    // Secondary dynamic cutout: 2MASS infrared survey
    candidates.push({
      url: dynamic2MassUrl(object.raDeg, object.decDeg, fov),
      source: "CDS Strasbourg / 2MASS Infrared",
    });
  }

  // Deduplicate candidates by URL
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (!c.url || seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}

export function ObjectImage({ id, size = 256, object }: ObjectImageProps) {
  const [urls, setUrls] = useState<Record<string, { image: string; thumb: string }>>(
    cachedUrls || {}
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const nightMode = useSkyStore((s) => s.overlays.nightMode);

  // Load catalog URLs in background if not already cached
  useEffect(() => {
    if (!cachedUrls) {
      getUrlsMap().then((m) => {
        setUrls(m);
      });
    }
  }, []);

  // Reset candidate state when active object changes
  useEffect(() => {
    setCandidateIndex(0);
    setLoading(true);
    setFailed(false);
  }, [id]);

  const candidates = useMemo(() => {
    return getCandidates(id, object, urls);
  }, [id, object, urls]);

  const currentCandidate = candidates[candidateIndex];

  if (!currentCandidate || failed) {
    return (
      <div
        className="img-missing"
        style={{
          width: "100%",
          height: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(10, 16, 32, 0.4)",
          border: "1px dashed var(--line, #5a2a2a)",
          color: "var(--dim, #6f86ad)",
          fontSize: 11,
          margin: "8px 0 12px",
          gap: 4,
          letterSpacing: "0.08em",
        }}
      >
        <span style={{ opacity: 0.6 }}>[ OPTICAL SENSOR OFFLINE ]</span>
        <span style={{ fontSize: 10, opacity: 0.4 }}>No imagery telemetred</span>
      </div>
    );
  }

  return (
    <>
      <figure
        className="object-image-container"
        style={{
          position: "relative",
          margin: "8px 0 12px",
          width: "100%",
          background: "#02040a",
          border: "1px solid var(--line, #5a2a2a)",
          overflow: "hidden",
        }}
      >
        {/* Corner HUD brackets */}
        <span className="hud-corner-tl" />
        <span className="hud-corner-tr" />
        <span className="hud-corner-bl" />
        <span className="hud-corner-br" />

        {/* Telemetry Tag */}
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 6,
            fontSize: 9,
            letterSpacing: "0.1em",
            color: "var(--accent, #5ec8ff)",
            background: "rgba(4, 6, 13, 0.75)",
            padding: "1px 5px",
            border: "1px solid rgba(94, 200, 255, 0.2)",
            zIndex: 2,
            textTransform: "uppercase",
          }}
        >
          VIEWPORT // {id}
        </div>

        {/* Click to expand button */}
        <button
          onClick={() => setModalOpen(true)}
          title="Click to view full image"
          style={{
            position: "absolute",
            top: 4,
            right: 6,
            fontSize: 9,
            padding: "1px 5px",
            background: "rgba(4, 6, 13, 0.75)",
            border: "1px solid var(--line, #5a2a2a)",
            color: "var(--text, #cfe3ff)",
            zIndex: 2,
            cursor: "pointer",
          }}
        >
          EXPAND ⛶
        </button>

        {/* Image viewport */}
        <div
          className="object-image-frame"
          onClick={() => setModalOpen(true)}
          style={{
            width: "100%",
            height: 180,
            overflow: "hidden",
            cursor: "zoom-in",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: "var(--dim)",
                background: "rgba(4, 6, 13, 0.8)",
                zIndex: 1,
              }}
            >
              [ ACQUIRING OPTICAL TELEMETRY... ]
            </div>
          )}

          <img
            key={currentCandidate.url}
            src={currentCandidate.url}
            alt={object?.name || id}
            loading="lazy"
            onLoad={() => setLoading(false)}
            onError={() => {
              if (candidateIndex + 1 < candidates.length) {
                // Seamlessly advance to the next candidate fallback
                setCandidateIndex((idx) => idx + 1);
              } else {
                setLoading(false);
                setFailed(true);
              }
            }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transition: "transform 0.2s ease",
            }}
          />
        </div>

        {/* Source caption */}
        <figcaption
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "3px 8px",
            fontSize: 10,
            color: "var(--dim, #6f86ad)",
            borderTop: "1px solid rgba(28, 42, 74, 0.5)",
            background: "rgba(10, 16, 32, 0.7)",
          }}
        >
          <span>{currentCandidate.source}</span>
          <span style={{ opacity: 0.7 }}>J2000 OPTICAL</span>
        </figcaption>
      </figure>

      {/* Lightbox / Modal for enlarged full view */}
      {modalOpen && (
        <div
          className="overlay"
          onClick={() => setModalOpen(false)}
          style={{ zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 0 }}
        >
          <div
            className="palette"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(540px, 94vw)",
              background: "#040711",
              border: "1px solid var(--accent)",
              padding: 0,
              boxShadow: "0 0 30px rgba(0, 0, 0, 0.8)",
            }}
          >
            <div className="modal-header">
              <span>// OPTICAL TELEMETRY: {object?.name || id}</span>
              <button className="close-btn" onClick={() => setModalOpen(false)}>
                &times;
              </button>
            </div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1 / 1",
                  maxHeight: "65vh",
                  border: "1px solid var(--line)",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#000",
                }}
              >
                <img
                  src={currentCandidate.url}
                  alt={object?.name || id}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--dim)",
                  padding: "0 4px",
                }}
              >
                <span>SURVEY: {currentCandidate.source}</span>
                {object && (
                  <span>
                    RA: {(object.raDeg / 15).toFixed(3)}h · Dec: {object.decDeg.toFixed(3)}°
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ObjectImage;
