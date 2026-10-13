"use client";

import { useSkyStore } from "@/store/useSkyStore";
import BootScreen from "@/components/os-shell/BootScreen";
import TopBar from "@/components/os-shell/TopBar";
import SyscallLog from "@/components/os-shell/SyscallLog";
import AlertToast from "@/components/os-shell/AlertToast";
import SkyCanvas from "@/components/starmap/SkyCanvas";
import LeftRail from "@/components/starmap/LeftRail";
import TimeBar from "@/components/starmap/TimeBar";
import InfoPanel from "@/components/starmap/InfoPanel";
import SearchPalette from "@/components/starmap/SearchPalette";
import ObserverDialog from "@/components/starmap/ObserverDialog";
import HelpOverlay from "@/components/starmap/HelpOverlay";

export default function Home() {
  const booted = useSkyStore((s) => s.booted);
  const nightMode = useSkyStore((s) => s.overlays.nightMode);

  if (!booted) return <BootScreen />;

  return (
    <main className={`shell ${nightMode ? "night" : ""}`}>
      <TopBar />
      <div className="workspace">
        <LeftRail />
        <SkyCanvas />
        <InfoPanel />
      </div>
      <TimeBar />
      <SyscallLog />
      <AlertToast />
      <SearchPalette />
      <ObserverDialog />
      <HelpOverlay />
    </main>
  );
}
