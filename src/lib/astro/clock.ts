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

export const RATES = [1, 10, 100, 1000, 10000, 100000];
