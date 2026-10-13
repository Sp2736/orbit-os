"use client";

import { useEffect } from "react";
import { useSkyStore } from "@/store/useSkyStore";

const SHORTCUTS = [
  { key: "Arrow Keys", action: "Pan the celestial sphere (Azimuth / Altitude)" },
  { key: "+ / -", action: "Zoom in / out (narrow or widen Field of View)" },
  { key: "Space", action: "Toggle simulation clock Play / Pause" },
  { key: "[ / ]", action: "Decrease / increase simulation speed rate" },
  { key: "R", action: "Reverse simulation time flow direction" },
  { key: "N", action: "Jump simulation time to current system time (Now)" },
  { key: "/ or Ctrl+K", action: "Open celestial object Search Palette" },
  { key: "C", action: "Toggle constellation stick figures" },
  { key: "L", action: "Toggle star and object name labels" },
  { key: "G", action: "Toggle Alt/Az & Equatorial coordinate grids" },
  { key: "M", action: "Toggle Night Mode (red eye-protection palette)" },
  { key: "T", action: "Toggle live tracking of selected celestial object" },
  { key: "?", action: "Toggle this Keyboard Shortcuts reference" },
  { key: "Esc", action: "Close open dialogues, panels, and modals" },
];


export default function HelpOverlay() {
  const open = useSkyStore((s) => s.helpOpen);
  const setOpen = useSkyStore((s) => s.setHelpOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={() => setOpen(false)}>
      <div className="palette help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>// KEYBOARD SHORTCUTS REFERENCE</span>
          <button className="close-btn" onClick={() => setOpen(false)}>&times;</button>
        </div>

        <div className="modal-body">
          <table className="shortcut-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left", width: "35%" }}>KEY</th>
                <th style={{ textAlign: "left" }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.key}>
                  <td>
                    <kbd className="key-badge">{s.key}</kbd>
                  </td>
                  <td>{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="modal-actions" style={{ marginTop: "1.2rem" }}>
            <button className="on" onClick={() => setOpen(false)}>Close [Esc]</button>
          </div>
        </div>
      </div>
    </div>
  );
}
