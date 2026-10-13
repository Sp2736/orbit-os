"use client";

import { useSkyStore } from "@/store/useSkyStore";

export default function SyscallLog() {
  const open = useSkyStore((s) => s.syscallOpen);
  const log = useSkyStore((s) => s.syscalls);
  if (!open) return null;
  return (
    <div className="drawer">
      {log.length === 0 && <span className="dim">no syscalls yet</span>}
      {log.slice().reverse().map((e, i) => (
        <div key={i}>
          <span className="dim">{new Date(e.t).toISOString().slice(11, 23)}</span> {e.name}({e.args}) <span className="brand">-&gt; {e.result}</span>
        </div>
      ))}
    </div>
  );
}
