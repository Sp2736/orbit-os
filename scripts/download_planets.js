const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public", "images", "bodies");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const list = [
  { file: "sun.jpg", url: "https://upload.wikimedia.org/wikipedia/commons/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg" },
  { file: "moon.jpg", url: "https://upload.wikimedia.org/wikipedia/commons/e/e1/FullMoon2010.jpg" },
  { file: "mercury.jpg", url: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Mercury_in_true_color.jpg" },
  { file: "venus.jpg", url: "https://upload.wikimedia.org/wikipedia/commons/0/08/Venus_from_Mariner_10.jpg" },
  { file: "mars.jpg", url: "https://upload.wikimedia.org/wikipedia/commons/0/02/OSIRIS_Mars_true_color.jpg" },
  { file: "jupiter.jpg", url: "https://upload.wikimedia.org/wikipedia/commons/e/e2/Jupiter.jpg" },
  { file: "saturn.jpg", url: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Saturn_during_Equinox.jpg" },
  { file: "uranus.jpg", url: "https://upload.wikimedia.org/wikipedia/commons/6/69/Uranus_Voyager2_color_calibrated.png" },
  { file: "neptune.jpg", url: "https://upload.wikimedia.org/wikipedia/commons/b/b9/Neptune_Voyager2_color_calibrated.png" },
];

for (const item of list) {
  const dest = path.join(dir, item.file);
  console.log(`Downloading ${item.file}...`);
  execFileSync("curl.exe", [
    "-s",
    "-L",
    "-A",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    item.url,
    "-o",
    dest,
  ]);
  const sz = fs.statSync(dest).size;
  console.log(`-> ${item.file}: ${sz} bytes`);
}
console.log("All planet images downloaded successfully.");
