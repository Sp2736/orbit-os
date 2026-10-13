"use client";

import { useEffect, useState } from "react";
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

// Verified high-resolution public NASA/mission imagery for Solar System bodies
const SOLAR_SYSTEM_IMAGES: Record<string, { image: string; source: string }> = {
  sun: {
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg/512px-The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg",
    source: "NASA SDO / AIA",
  },
  moon: {
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/512px-FullMoon2010.jpg",
    source: "NASA / GSFC / LRO",
  },
  "planet:mercury": {
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Mercury_in_true_color.jpg/512px-Mercury_in_true_color.jpg",
    source: "NASA / JHUAPL / MESSENGER",
  },
  "planet:venus": {
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Venus-real_color.jpg/512px-Venus-real_color.jpg",
    source: "NASA / Mariner 10",
  },
  "planet:mars": {
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/OSIRIS_Mars_true_color.jpg/512px-OSIRIS_Mars_true_color.jpg",
    source: "ESA / OSIRIS / NASA",
  },
  "planet:jupiter": {
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Jupiter.jpg/512px-Jupiter.jpg",
    source: "NASA / JPL / Cassini",
  },
  "planet:saturn": {
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Saturn_during_Equinox.jpg/512px-Saturn_during_Equinox.jpg",
    source: "NASA / JPL / Cassini",
  },
  "planet:uranus": {
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Uranus2.jpg/512px-Uranus2.jpg",
    source: "NASA / JPL / Voyager 2",
  },
  "planet:neptune": {
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Neptune.jpg/512px-Neptune.jpg",
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

export function ObjectImage({ id, size = 256, object }: ObjectImageProps) {
  const [urls, setUrls] = useState<Record<string, { image: string; thumb: string }>>(
    cachedUrls || {}
  );
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const nightMode = useSkyStore((s) => s.overlays.nightMode);

  useEffect(() => {
    setFailed(false);
    setLoading(true);
    if (!cachedUrls) {
      getUrlsMap().then((m) => {
        setUrls(m);
      });
    }
  }, [id]);

  // 1. Check Solar System bodies
  const solar = SOLAR_SYSTEM_IMAGES[id];
  let imageUrl = "";
  let sourceText = "DSS2 via CDS Strasbourg";

  if (solar) {
    imageUrl = solar.image;
    sourceText = solar.source;
  } else {
    // 2. Direct hit in urls.json
    let entry = urls[id];

    // 3. Cross-reference lookup (e.g. ngc:4594 -> messier:104)
    if (!entry) {
      const xref = getXref();
      if (xref) {
        if (id.startsWith("ngc:")) {
          const mId = xref.ngc?.[id.slice(4)];
          if (mId && urls[mId]) entry = urls[mId];
        } else if (id.startsWith("messier:")) {
          const mNum = id.slice(8);
          const ngcId = xref.messier?.[mNum];
          if (ngcId && urls[ngcId]) entry = urls[ngcId];
        } else if (id.startsWith("ic:")) {
          const mId = xref.ic?.[id.slice(3)];
          if (mId && urls[mId]) entry = urls[mId];
        }
      }
    }

    if (entry) {
      imageUrl = sanitizeHipsUrl(entry.image);
    } else if (object && !isNaN(object.raDeg) && !isNaN(object.decDeg)) {
      // 4. Dynamic DSS2 cutout for any celestial body with coordinates
      imageUrl = dynamicDss2Url(object.raDeg, object.decDeg);
    }
  }

  if (!imageUrl || failed) {
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
            src={imageUrl}
            alt={object?.name || id}
            loading="lazy"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
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
          <span>{sourceText}</span>
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
                  src={imageUrl}
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
                <span>SURVEY: {sourceText}</span>
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
