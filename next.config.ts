import type { NextConfig } from "next";

// Static export: no Node server needed, so the same build runs in a browser
// kiosk, Electron, or any static file server on Ubuntu and Arch.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
