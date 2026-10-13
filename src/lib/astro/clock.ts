// Simulation clock singleton. The rAF loop calls tick(); React state only sees a throttled copy.

class SimClock {
  private simMs = Date.now();
  private lastReal = 0;
  rate = 1;          // simulated seconds per real second (negative = reverse)
  playing = true;

  tick(nowReal: number) {
    if (this.lastReal === 0) this.lastReal = nowReal;
    const dtReal = (nowReal - this.lastReal) / 1000;
    this.lastReal = nowReal;
    if (this.playing) this.simMs += dtReal * this.rate * 1000;
  }

  now(): number {
    return this.simMs;
  }

  set(ms: number) {
    this.simMs = ms;
  }

  jumpToNow() {
    this.simMs = Date.now();
    this.rate = 1;
    this.playing = true;
  }

  offset(deltaMs: number) {
    this.simMs += deltaMs;
  }
}

export const clock = new SimClock();

export interface RateOption {
  value: number;
  label: string;
}

export const RATE_OPTIONS: RateOption[] = [
  { value: 1, label: "x1" },
  { value: 10, label: "x10" },
  { value: 60, label: "1 min/s" },
  { value: 600, label: "10 min/s" },
  { value: 3600, label: "1 hr/s" },
  { value: 86400, label: "1 day/s" },
  { value: 604800, label: "1 wk/s" },
];

export const RATES = RATE_OPTIONS.map((o) => o.value);

export function formatRateLabel(rate: number): string {
  const abs = Math.abs(rate);
  const sign = rate < 0 ? "REV " : "";
  const match = RATE_OPTIONS.find((o) => o.value === abs);
  if (match) return `${sign}${match.label}`;
  return `${sign}x${abs}`;
}
