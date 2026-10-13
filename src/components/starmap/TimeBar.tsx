"use client";

import { clock, RATES } from "@/lib/astro/clock";
import { useSkyStore } from "@/store/useSkyStore";
import { sys } from "@/lib/os/syscalls";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export default function TimeBar() {
  const rate = useSkyStore((s) => s.rate);
  const playing = useSkyStore((s) => s.playing);
  const mirror = useSkyStore((s) => s.setClockMirror);

  const apply = (label: string, fn: () => void) => {
    fn();
    mirror({ displayTimeMs: clock.now(), rate: clock.rate, playing: clock.playing });
    sys("sys_clock_set", { action: label, rate: clock.rate, playing: String(clock.playing) });
  };

  const faster = () => {
    const i = RATES.indexOf(Math.abs(clock.rate));
    clock.rate = Math.sign(clock.rate || 1) * RATES[Math.min(RATES.length - 1, i + 1)];
  };
  const slower = () => {
    const i = RATES.indexOf(Math.abs(clock.rate));
    clock.rate = Math.sign(clock.rate || 1) * RATES[Math.max(0, i - 1)];
  };

  return (
    <footer className="timebar">
      <button onClick={() => apply("-1d", () => clock.offset(-DAY))}>-1d</button>
      <button onClick={() => apply("-1h", () => clock.offset(-HOUR))}>-1h</button>
      <button onClick={() => apply("reverse", () => { clock.rate = -clock.rate; })}>Reverse</button>
      <button onClick={() => apply("slower", slower)}>&laquo;</button>
      <button className={playing ? "on" : ""} onClick={() => apply("toggle", () => { clock.playing = !clock.playing; })}>{playing ? "Pause" : "Play"}</button>
      <button onClick={() => apply("faster", faster)}>&raquo;</button>
      <button onClick={() => apply("+1h", () => clock.offset(HOUR))}>+1h</button>
      <button onClick={() => apply("+1d", () => clock.offset(DAY))}>+1d</button>
      <button onClick={() => apply("now", () => clock.jumpToNow())}>Now</button>
      <span className="dim">rate x{rate}</span>
      {/* TODO(agent): date-time picker + timeline scrubber (docs/07-ui-spec.md) */}
    </footer>
  );
}
