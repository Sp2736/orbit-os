/**
 * Smooth view slew animation for the sky canvas (task 1.1).
 *
 * The rAF loop calls slew.tick(now) every frame and reads slew.active / slew.az / slew.alt / slew.fov.
 * Any user pan/drag/key press must call slew.cancel() so the animation stops immediately.
 *
 * Duration: SLEW_MS ms, cubic ease-out (feels like a spacecraft camera deceleration).
 * References: 03-task-plan.md task 1.1, 07-ui-spec.md §Motion.
 */

const SLEW_MS = 600; // ms – matches the spec's "about 600 ms"

/** Wraps an angle (degrees) to [-180, 180) for shortest-path interpolation. */
function wrapDelta(delta: number): number {
  return ((delta + 540) % 360) - 180;
}

/** Cubic ease-out: 1 - (1-t)^3 */
function easeOut(t: number): number {
  const s = 1 - t;
  return 1 - s * s * s;
}

interface SlewState {
  active: boolean;
  az: number;
  alt: number;
  fov: number;
}

class SlewController {
  active = false;

  private startAz = 0;
  private startAlt = 0;
  private startFov = 0;
  private targetAz = 0;
  private targetAlt = 0;
  private targetFov = 0;
  private startTime = 0;

  /** Current interpolated view (only valid when active === true). */
  az = 0;
  alt = 0;
  fov = 0;

  /** Begin a slew from `from` → `to`. fov is optional – omit to keep current. */
  start(
    from: { az: number; alt: number; fov: number },
    to: { az: number; alt: number; fov?: number },
    nowMs: number,
  ): void {
    this.startAz = from.az;
    this.startAlt = from.alt;
    this.startFov = from.fov;
    this.targetAz = from.az + wrapDelta(to.az - from.az); // shortest arc
    this.targetAlt = Math.max(-89, Math.min(89, to.alt));
    this.targetFov = to.fov !== undefined ? Math.max(0.5, Math.min(150, to.fov)) : from.fov;
    this.startTime = nowMs;
    this.active = true;
    // Seed current values so callers don't see a frame with stale data.
    this.az = from.az;
    this.alt = from.alt;
    this.fov = from.fov;
  }

  /** Call once per rAF frame. Updates az/alt/fov; sets active=false when done. */
  tick(nowMs: number): void {
    if (!this.active) return;
    const t = Math.min(1, (nowMs - this.startTime) / SLEW_MS);
    const e = easeOut(t);
    this.az = (((this.startAz + wrapDelta(this.targetAz - this.startAz) * e) % 360) + 360) % 360;
    this.alt = this.startAlt + (this.targetAlt - this.startAlt) * e;
    this.fov = this.startFov + (this.targetFov - this.startFov) * e;
    if (t >= 1) this.active = false;
  }

  /** Cancel the slew (user touched the input). */
  cancel(): void {
    this.active = false;
  }

  /** Snapshot of the current interpolated view, only meaningful when active. */
  snapshot(): SlewState {
    return { active: this.active, az: this.az, alt: this.alt, fov: this.fov };
  }
}

export const slew = new SlewController();
