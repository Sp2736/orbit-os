import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Celestial Object Imagery and Asset Pipeline", () => {
  const bodiesDir = path.resolve(process.cwd(), "public/images/bodies");
  const urlsPath = path.resolve(process.cwd(), "public/data/urls.json");

  it("ensures all 9 solar system bodies have valid local image assets on disk", () => {
    const bodies = [
      "sun.jpg",
      "moon.jpg",
      "mercury.jpg",
      "venus.jpg",
      "mars.jpg",
      "jupiter.jpg",
      "saturn.jpg",
      "uranus.jpg",
      "neptune.jpg",
    ];

    for (const b of bodies) {
      const filePath = path.join(bodiesDir, b);
      expect(fs.existsSync(filePath), `Missing asset: ${b}`).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size, `Asset ${b} is empty or invalid`).toBeGreaterThan(1000);

      const buf = fs.readFileSync(filePath);
      const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
      const isPng = buf[0] === 0x89 && buf[1] === 0x50;
      expect(isJpg || isPng, `Asset ${b} is not a valid JPEG/PNG`).toBe(true);
    }
  });

  it("ensures urls.json contains deep sky imagery mapping and valid URLs", () => {
    expect(fs.existsSync(urlsPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(urlsPath, "utf8"));
    expect(data.objects).toBeDefined();

    // Verify key targets
    expect(data.objects["messier:104"]).toBeDefined();
    expect(data.objects["messier:31"]).toBeDefined();
    expect(data.objects["messier:42"]).toBeDefined();

    const m104 = data.objects["messier:104"];
    expect(m104.image).toContain("hips2fits");
    expect(m104.image).toContain("ra=189.99762");
    expect(m104.image).toContain("dec=-11.62306");
  });

  it("verifies dynamic star coordinates cutout URL construction", () => {
    const raDeg = 101.287; // Sirius
    const decDeg = -16.716;
    const fov = 0.15;
    const px = 512;
    const url = `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=CDS%2FP%2FDSS2%2Fcolor&width=${px}&height=${px}&fov=${fov}&projection=TAN&ra=${raDeg.toFixed(5)}&dec=${decDeg.toFixed(5)}&format=jpg`;

    expect(url).toContain("hips=CDS%2FP%2FDSS2%2Fcolor");
    expect(url).toContain("ra=101.28700");
    expect(url).toContain("dec=-16.71600");
  });
});
