"use client";

import { useEffect, useState, useRef } from "react";
import { clock, RATE_OPTIONS, formatRateLabel, RATES } from "@/lib/astro/clock";
import { useSkyStore } from "@/store/useSkyStore";
import { sys } from "@/lib/os/syscalls";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

function formatUtcIso(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export default function TimeBar() {
  const displayMs = useSkyStore((s) => s.displayTimeMs);
  const rate = useSkyStore((s) => s.rate);
  const playing = useSkyStore((s) => s.playing);
  const mirror = useSkyStore((s) => s.setClockMirror);

  // Date input state
  const [dateInput, setDateInput] = useState(formatUtcIso(displayMs));
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [inputError, setInputError] = useState(false);

  // Scrubber state (Task 4.3: +/- 24h around current sim time)
  const [scrubberVal, setScrubberVal] = useState(0); // offset in hours (-24 to +24)
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubberAnchorRef = useRef<number>(displayMs);

  // Update input text when display time changes (unless user is actively typing)
  useEffect(() => {
    if (!isEditingDate) {
      setDateInput(formatUtcIso(displayMs));
      setInputError(false);
    }
  }, [displayMs, isEditingDate]);

  const apply = (label: string, fn: () => void) => {
    fn();
    mirror({ displayTimeMs: clock.now(), rate: clock.rate, playing: clock.playing });
    sys("sys_clock_set", { action: label, rate: clock.rate, playing: String(clock.playing) });
  };

  const faster = () => {
    const curAbs = Math.abs(clock.rate);
    const i = RATES.indexOf(curAbs);
    const next = i >= 0 && i < RATES.length - 1 ? RATES[i + 1] : RATES[0];
    clock.rate = Math.sign(clock.rate || 1) * next;
  };

  const slower = () => {
    const curAbs = Math.abs(clock.rate);
    const i = RATES.indexOf(curAbs);
    const prev = i > 0 ? RATES[i - 1] : RATES[0];
    clock.rate = Math.sign(clock.rate || 1) * prev;
  };

  // Task 4.1: Typing a date jumps the sky there
  const commitDateInput = () => {
    setIsEditingDate(false);
    const trimmed = dateInput.trim();
    // Accept "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD HH:mm", or "YYYY-MM-DD"
    const parsed = Date.parse(trimmed.endsWith("Z") ? trimmed : `${trimmed.replace(" ", "T")}Z`);
    if (!isNaN(parsed)) {
      setInputError(false);
      apply("date_picker", () => {
        clock.set(parsed);
      });
    } else {
      setInputError(true);
      setDateInput(formatUtcIso(clock.now()));
    }
  };

  // Task 4.3: Smooth Scrubbing
  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hours = parseFloat(e.target.value);
    setScrubberVal(hours);
    const targetMs = scrubberAnchorRef.current + hours * HOUR;
    clock.set(targetMs);
    mirror({ displayTimeMs: targetMs });
  };

  const startScrubbing = () => {
    setIsScrubbing(true);
    scrubberAnchorRef.current = clock.now();
    setScrubberVal(0);
  };

  const stopScrubbing = () => {
    setIsScrubbing(false);
    setScrubberVal(0);
    sys("sys_clock_set", { action: "timeline_scrub", simTime: String(clock.now()) });
  };

  return (
    <footer className="timebar">
      {/* ── Rate controls & direction ────────────────────────────────────────── */}
      <div className="timebar-section">
        <button
          title="Reverse simulation direction (R)"
          className={rate < 0 ? "on" : ""}
          onClick={() => apply("reverse", () => { clock.rate = -clock.rate; })}
        >
          REV
        </button>
        <button title="Slower rate ([)" onClick={() => apply("slower", slower)}>&laquo;</button>
        <button
          title="Toggle Play / Pause (Space)"
          className={playing ? "on" : ""}
          onClick={() => apply("toggle", () => { clock.playing = !clock.playing; })}
        >
          {playing ? "PAUSE" : "PLAY"}
        </button>
        <button title="Faster rate (])" onClick={() => apply("faster", faster)}>&raquo;</button>
      </div>

      {/* ── Rate selector dropdown (Task 4.2) ─────────────────────────────────── */}
      <div className="timebar-section">
        <select
          className="rate-select"
          value={Math.abs(rate)}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            apply(`rate_${val}`, () => {
              clock.rate = Math.sign(clock.rate || 1) * val;
            });
          }}
          aria-label="Simulation speed rate selector"
        >
          {RATE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="rate-badge dim">{formatRateLabel(rate)}</span>
      </div>

      {/* ── Step offsets & Now ────────────────────────────────────────────────── */}
      <div className="timebar-section">
        <button title="Step backward 1 day" onClick={() => apply("-1d", () => clock.offset(-DAY))}>-1d</button>
        <button title="Step backward 1 hour" onClick={() => apply("-1h", () => clock.offset(-HOUR))}>-1h</button>
        <button title="Step forward 1 hour" onClick={() => apply("+1h", () => clock.offset(HOUR))}>+1h</button>
        <button title="Step forward 1 day" onClick={() => apply("+1d", () => clock.offset(DAY))}>+1d</button>
        <button title="Jump to current real time (N)" onClick={() => apply("now", () => clock.jumpToNow())}>NOW</button>
      </div>

      {/* ── Date-Time Input (Task 4.1) ────────────────────────────────────────── */}
      <div className="timebar-section date-section">
        <label className="dim">UTC:</label>
        <input
          type="text"
          className={`date-input ${inputError ? "error" : ""}`}
          value={dateInput}
          onChange={(e) => {
            setDateInput(e.target.value);
            setIsEditingDate(true);
          }}
          onFocus={() => setIsEditingDate(true)}
          onBlur={commitDateInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitDateInput();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setIsEditingDate(false);
              setDateInput(formatUtcIso(clock.now()));
              (e.target as HTMLInputElement).blur();
            }
          }}
          title="Type date and press Enter (e.g. 2026-10-13 16:50:00)"
        />
      </div>

      {/* ── Timeline Scrubber (Task 4.3: +/-24h) ──────────────────────────────── */}
      <div className="timebar-section scrubber-section">
        <span className="dim scrubber-label">-24h</span>
        <input
          type="range"
          className="scrubber-range"
          min="-24"
          max="24"
          step="0.1"
          value={scrubberVal}
          onMouseDown={startScrubbing}
          onTouchStart={startScrubbing}
          onChange={handleScrubberChange}
          onMouseUp={stopScrubbing}
          onTouchEnd={stopScrubbing}
          aria-label="Timeline scrubber +/- 24 hours"
        />
        <span className="dim scrubber-label">+24h</span>
        {isScrubbing && (
          <span className="scrubber-badge">
            {scrubberVal >= 0 ? `+${scrubberVal.toFixed(1)}h` : `${scrubberVal.toFixed(1)}h`}
          </span>
        )}
      </div>
    </footer>
  );
}
