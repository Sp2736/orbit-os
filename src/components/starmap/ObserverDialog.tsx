"use client";

import { useEffect, useState } from "react";
import { useSkyStore } from "@/store/useSkyStore";
import { OBSERVER_PRESETS } from "@/config/observerPresets";
import { sys } from "@/lib/os/syscalls";
import type { Observer } from "@/lib/astro/types";

export default function ObserverDialog() {
  const open = useSkyStore((s) => s.observerOpen);
  const setOpen = useSkyStore((s) => s.setObserverOpen);
  const currentObs = useSkyStore((s) => s.observer);
  const setObserver = useSkyStore((s) => s.setObserver);

  const [name, setName] = useState(currentObs.name);
  const [lat, setLat] = useState(String(currentObs.lat));
  const [lon, setLon] = useState(String(currentObs.lon));
  const [elev, setElev] = useState(String(currentObs.elevation));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentObs.name);
      setLat(String(currentObs.lat));
      setLon(String(currentObs.lon));
      setElev(String(currentObs.elevation));
      setError(null);
    }
  }, [open, currentObs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const selectPreset = (p: Observer) => {
    setName(p.name);
    setLat(String(p.lat));
    setLon(String(p.lon));
    setElev(String(p.elevation));
    setError(null);
    setObserver(p);
    sys("sys_observer_set", { name: p.name, lat: String(p.lat), lon: String(p.lon) });
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);
    const parsedElev = parseFloat(elev) || 0;

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setError("Latitude must be between -90° and +90°");
      return;
    }
    if (isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180) {
      setError("Longitude must be between -180° and +180°");
      return;
    }

    const obs: Observer = {
      name: name.trim() || `${parsedLat.toFixed(2)}°, ${parsedLon.toFixed(2)}°`,
      lat: parsedLat,
      lon: parsedLon,
      elevation: parsedElev,
    };
    setObserver(obs);
    sys("sys_observer_set", { name: obs.name, lat: String(obs.lat), lon: String(obs.lon) });
    setOpen(false);
  };

  return (
    <div className="overlay" onClick={() => setOpen(false)}>
      <div className="palette observer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>// OBSERVER LOCATION</span>
          <button className="close-btn" onClick={() => setOpen(false)}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="section-label">SELECT PRESET</div>
          <div className="preset-grid">
            {OBSERVER_PRESETS.map((p) => {
              const active = currentObs.name === p.name || (currentObs.lat === p.lat && currentObs.lon === p.lon);
              return (
                <button
                  key={p.name}
                  type="button"
                  className={`preset-btn ${active ? "on" : ""}`}
                  onClick={() => selectPreset(p)}
                >
                  <div className="preset-name">{p.name}</div>
                  <div className="dim preset-coords">{p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°</div>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleApply} className="manual-form">
            <div className="section-label" style={{ marginTop: "1rem" }}>MANUAL COORDINATES</div>
            {error && <div className="form-error">{error}</div>}

            <div className="form-row">
              <label>Location Label</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Field Station 4"
              />
            </div>

            <div className="form-cols">
              <div className="form-row">
                <label>Latitude (-90 to +90)</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="22.30"
                />
              </div>

              <div className="form-row">
                <label>Longitude (-180 to +180)</label>
                <input
                  type="number"
                  step="any"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="73.18"
                />
              </div>

              <div className="form-row">
                <label>Elevation (m)</label>
                <input
                  type="number"
                  step="any"
                  value={elev}
                  onChange={(e) => setElev(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="on">Apply Coordinates</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
