"use client";

import { useEffect, useState } from "react";
import { OS_NAME, OS_VERSION, OS_CODENAME } from "@/config/os";
import { useSkyStore } from "@/store/useSkyStore";

// TODO(agent): keep lines in sync with the boot chain in the OS design doc (Ch. 6).
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
  const setBooted = useSkyStore((s) => s.setBooted);

  useEffect(() => {
    if (n >= LINES.length) {
      const t = setTimeout(() => setBooted(true), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v + 1), 260);
    return () => clearTimeout(t);
  }, [n, setBooted]);

  return (
    <div className="boot" onClick={() => setBooted(true)}>
      <pre>{LINES.slice(0, n).join("\n")}</pre>
      <span className="dim">click to skip</span>
    </div>
  );
}
