import { describe, it, expect } from "vitest";
import { equatorialToHorizontal, horizontalToEquatorial, projectHorizontal } from "@/lib/astro/projection";
import { gmstDeg } from "@/lib/astro/time";

describe("coordinate maths", () => {
  it("object on the meridian at dec = lat is at the zenith", () => {
    const hz = equatorialToHorizontal(100, 22, 22, 100);
    expect(hz.altDeg).toBeCloseTo(90, 3);
  });
  it("round-trips equatorial -> horizontal -> equatorial", () => {
    const hz = equatorialToHorizontal(83.6, -5.4, 22.3, 140);
    const eq = horizontalToEquatorial(hz.altDeg, hz.azDeg, 22.3, 140);
    expect(eq.raDeg).toBeCloseTo(83.6, 3);
    expect(eq.decDeg).toBeCloseTo(-5.4, 3);
  });
  it("view centre projects to the canvas centre", () => {
    const p = projectHorizontal(45, 180, { az: 180, alt: 45, fov: 90 }, 800, 600);
    expect(p.x).toBeCloseTo(400, 3);
    expect(p.y).toBeCloseTo(300, 3);
  });
  it("GMST at J2000 epoch matches the reference value", () => {
    const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
    expect(gmstDeg(j2000)).toBeCloseTo(280.46, 1);
  });

  it("Polaris altitude at latitude 22.3 N is about 22 degrees", () => {
    // Polaris J2000 RA ~37.95°, Dec ~89.26° (about 0.74° from celestial pole)
    const hz = equatorialToHorizontal(37.95, 89.26, 22.3, 37.95);
    expect(Math.abs(hz.altDeg - 22.3)).toBeLessThan(1.5);
  });

  it("changing latitude to southern hemisphere flips the visible sky", () => {
    // At South Pole (lat -90), northern star Polaris is far below horizon
    const hzSouth = equatorialToHorizontal(37.95, 89.26, -90, 37.95);
    expect(hzSouth.altDeg).toBeLessThan(-85);

    // Southern celestial pole (dec -90) is at the zenith
    const sPole = equatorialToHorizontal(0, -90, -90, 0);
    expect(sPole.altDeg).toBeCloseTo(90, 1);
  });
});

describe("simulation clock & rate formatting", () => {
  it("formats human-readable rate labels correctly", async () => {
    const { formatRateLabel } = await import("@/lib/astro/clock");
    expect(formatRateLabel(1)).toBe("x1");
    expect(formatRateLabel(10)).toBe("x10");
    expect(formatRateLabel(60)).toBe("1 min/s");
    expect(formatRateLabel(3600)).toBe("1 hr/s");
    expect(formatRateLabel(86400)).toBe("1 day/s");
    expect(formatRateLabel(604800)).toBe("1 wk/s");
    expect(formatRateLabel(-60)).toBe("REV 1 min/s");
  });

  it("clock jumps and sets simulated time", async () => {
    const { clock } = await import("@/lib/astro/clock");
    const target = Date.UTC(2024, 2, 21, 12, 0, 0);
    clock.set(target);
    expect(clock.now()).toBe(target);
    clock.offset(3600_000);
    expect(clock.now()).toBe(target + 3600_000);
  });
});
