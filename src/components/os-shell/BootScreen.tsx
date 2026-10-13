"use client";

import { useEffect, useState } from "react";
import { OS_NAME, OS_VERSION, OS_CODENAME } from "@/config/os";
import { useSkyStore } from "@/store/useSkyStore";
import { loadCatalogs, isCatalogLoaded } from "@/lib/astro/catalogLoader";

// Keep lines in sync with the boot chain in the OS design doc (Ch. 6).
const LINES = [
  `${OS_NAME} ${OS_VERSION} "${OS_CODENAME}"`,
  "[ OK ] firmware handoff, secure boot verified",
  "[ OK ] kernel image loaded, MMU enabled",
  "[ OK ] interrupt vectors installed",
  "[ OK ] scheduler online (4 cores)",
  "[ OK ] mounting /sys/catalog (read-only)",
  "[ OK ] starting service: ephemerisd",
  "[ OK ] starting service: displayd",
  "[ OK ] launching Navigator",
];

export default function BootScreen() {
  const [n, setN] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const setBooted = useSkyStore((s) => s.setBooted);

  useEffect(() => {
    loadCatalogs().catch((err) => {
      setLoadError(err?.message || "Catalog data missing");
    });
  }, []);

  useEffect(() => {
    if (loadError) return;
    if (n >= LINES.length) {
      const t = setTimeout(() => {
        if (isCatalogLoaded()) {
          setBooted(true);
        }
      }, 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v + 1), 220);
    return () => clearTimeout(t);
  }, [n, loadError, setBooted]);

  const trySkip = () => {
    if (loadError) return;
    if (isCatalogLoaded()) {
      setBooted(true);
    }
  };

  if (loadError) {
    return (
      <div className="boot error">
        <pre>{LINES.slice(0, Math.min(n, 5)).join("\n")}</pre>
        <div style={{ color: "#ff6b6b", marginTop: "1rem", fontFamily: "monospace" }}>
          [ FAIL ] Catalog database missing or corrupted.
          <br /><br />
          Please run in terminal:
          <br />
          <code style={{ background: "#220000", padding: "2px 6px", borderRadius: 4 }}>
            npm run build:catalog
          </code>
          <br /><br />
          Details: {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="boot" onClick={trySkip}>
      <pre>{LINES.slice(0, n).join("\n")}</pre>
      <span className="dim">click to skip</span>
    </div>
  );
}
