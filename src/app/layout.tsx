import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OrbitOS Navigator",
  description: "Star map and OS shell mockup for the fictional OrbitOS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
