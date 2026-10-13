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
});
