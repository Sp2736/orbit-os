# OrbitOS Navigator

A Stellarium-style star map built as the flagship UI of **OrbitOS**, a fictional spacecraft operating system. Made for the "Build Your Dream OS" project (OS Design Doc + UI Mockup).

View the sky, run time forward or backward in real time, click any object for details, and search by common name or catalog designation. The app runs fully offline and is meant to work the same on **Ubuntu 26** and **Arch Linux + Hyprland**.

> Status: working skeleton. Core math, simulation clock, canvas renderer, search palette, OS shell and Electron wrapper exist; real catalogs, constellations, full info panel and polish are the remaining work (see "Roadmap").

## Features

| Area | Feature | State |
|------|---------|-------|
| Sky | Stars sized by magnitude, coloured by B-V | Demo data (24 stars); full catalog pending |
| Sky | Sun, Moon, planets via `astronomy-engine` | Working |
| Time | Simulated clock, x1 to x100000, reverse, pause, jumps | Working |
| Interaction | Drag to pan, wheel to zoom, click to select, keyboard control | Working |
| Search | Name, Bayer, HIP/HD/HR/Gliese, Messier/NGC/IC, fuzzy | Skeleton |
| Details | Info panel for the selected object | Basic |
| OS shell | Boot screen, status bar, syscall log, alerts, launcher | Boot, status bar, syscall log working; rest pending |
| Desktop | Electron window and kiosk mode | Working (Ubuntu); Arch untested |

## Tech stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js 16 (static export), React 19, TypeScript |
| Rendering | HTML Canvas 2D (WebGL fallback planned if needed) |
| Astronomy | `astronomy-engine` plus custom coordinate math |
| State | Zustand |
| Search | Custom alias index plus Fuse.js |
| Desktop | Electron (local static server, Wayland-aware flags) |
| Tests | Vitest |

## Quick start

Requirements: Node.js 22 or newer, npm, git.

```bash
git clone <your-repo-url> astraos-navigator
cd astraos-navigator
npm install
npm run dev          # open http://localhost:3000
```

### Ubuntu 26

```bash
# Node 22+ (example using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
nvm install 22

npm install
npm run build
npm run electron          # windowed
npm run electron:kiosk    # fullscreen OS-style demo
```

### Arch Linux + Hyprland

> Not yet verified on a real Arch + Hyprland machine. Update this note after testing.

```bash
sudo pacman -S nodejs npm git
npm install
npm run build
npm run electron
```

If the window is blurry or fails to start under Wayland, try `npx electron . --ozone-platform=wayland`, or force X11 with `--ozone-platform=x11`. Example Hyprland window rules:

```
windowrulev2 = fullscreen, class:^(OrbitOS Navigator)$
# or
windowrulev2 = float, class:^(OrbitOS Navigator)$
windowrulev2 = size 1400 900, class:^(OrbitOS Navigator)$
```

Confirm the real window class with `hyprctl clients`. Rule syntax can differ between Hyprland versions, so check the Hyprland wiki for yours.

### Browser-only kiosk (zero-packaging fallback)

```bash
npm run build && npm start
chromium --app=http://localhost:3000 --start-fullscreen
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Static export to `out/` |
| `npm start` | Serve `out/` on port 3000 |
| `npm run typecheck` | TypeScript check |
| `npm test` | Vitest unit tests |
| `npm run build:catalog` | Generate star/deep-sky/alias data into `public/data/` (to be implemented) |
| `npm run electron` | Run the exported app in Electron |
| `npm run electron:kiosk` | Same, fullscreen kiosk |
| `npm run electron:dev` | Electron against the dev server |
| `npm run dist` | Build AppImage and deb with electron-builder |

## Controls

| Input | Action |
|-------|--------|
| Drag | Pan the sky |
| Mouse wheel | Zoom |
| Click | Select object |
| Arrow keys | Pan |
| `+` / `-` | Zoom |
| `/` or `Ctrl+K` | Search |
| Space | Play / pause |
| `[` / `]` | Slower / faster time |

More shortcuts are specified in the UI spec and added during development.

## Project structure

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js entry, layout, global CSS |
| `src/components/os-shell/` | Boot screen, top bar, syscall log, alerts |
| `src/components/starmap/` | Sky canvas, left rail, time bar, info panel, search palette |
| `src/lib/astro/` | Time, sidereal time, projection, bodies, clock, catalog access |
| `src/lib/search/` | Query normalization and alias index |
| `src/lib/os/` | Fake syscall logger |
| `src/store/` | Zustand store |
| `src/config/os.ts` | OS name, version, vessel, default observer |
| `electron/` | Desktop wrapper |
| `scripts/` | Catalog build script |
| `public/data/` | Generated catalogs (gitignored) |
| `tests/` | Vitest tests |
| `docs/` | Local agent instruction files (gitignored, see below) |

## How the OS fiction works

The app is presented as the Navigator program running on OrbitOS. UI actions are mirrored as fake system calls (for example `sys_query_catalog(q=sirius, id=...)`) shown in the syscall drawer, which ties the mockup to the system-call chapter of the OS design document. Rename the OS in one place: `src/config/os.ts`.

## Working with the agent docs

The `docs/` folder holds instruction files for an autonomous coding agent (Antigravity) to finish the project. It is listed in `.gitignore` on purpose, so it stays local and never lands in the repository. Start with `docs/00-START-HERE.md`; the work queue is `docs/03-task-plan.md` and completion criteria are in `docs/12-definition-of-done.md`.

## Data sources and credits

Catalogs are generated at build time and bundled, so the app makes no network requests at runtime. Planned sources: HYG Database (stars), OpenNGC (deep-sky), d3-celestial (constellation lines), and `astronomy-engine` (solar system). Check each project's license and keep the in-app About screen up to date.

## Roadmap

| Phase | Focus |
|-------|-------|
| 1 | Core hardening: smooth slewing, zoom-to-cursor, touch |
| 2 | Real catalogs and typed-array renderer |
| 3 | Constellations, ground, grids, twilight, moon phase |
| 4 | Time controls UI, observer dialog |
| 5 | Full search and info panel |
| 6 | OS shell: boot, alerts, launcher, task manager |
| 7 | Polish, About screen, screenshots |
| 8 | Packaging and Arch + Hyprland verification |

## License

MIT for this project's code. Third-party data keeps its own license.
