// Electron wrapper. Serves the static Next.js export from a tiny local HTTP server
// (file:// breaks Next's absolute /_next/ asset paths) and opens it in a window.
const { app, BrowserWindow } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// Wayland (Hyprland): let Chromium pick the native backend, fall back to X11 if needed.
app.commandLine.appendSwitch("ozone-platform-hint", "auto");
app.commandLine.appendSwitch("enable-features", "WaylandWindowDecorations");

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain",
};

function startStaticServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      if (urlPath.endsWith("/")) urlPath += "index.html";
      const filePath = path.normalize(path.join(root, urlPath));
      if (!filePath.startsWith(root)) { res.writeHead(403); return res.end(); }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end("not found"); }
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

async function createWindow() {
  const kiosk = process.argv.includes("--kiosk");
  const win = new BrowserWindow({
    width: 1400, height: 900, backgroundColor: "#04060d",
    kiosk, autoHideMenuBar: true, title: "OrbitOS Navigator",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);

  if (process.env.ASTRA_DEV) {
    await win.loadURL("http://localhost:3000");
  } else {
    const port = await startStaticServer(path.join(__dirname, "..", "out"));
    await win.loadURL(`http://127.0.0.1:${port}/`);
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
