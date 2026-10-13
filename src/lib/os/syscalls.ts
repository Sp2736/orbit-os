import { useSkyStore } from "@/store/useSkyStore";

/**
 * Logs a fake OrbitOS system call. Every meaningful UI action should call this,
 * so the OS design document (Ch. 12) and the UI mockup (Ch. 17) tell the same story.
 * Names must exist in the syscall table in docs/08-os-shell-spec.md.
 */
export function sys(name: string, args: Record<string, string | number> | string = "", result = "OK") {
  const argStr =
    typeof args === "string"
      ? args
      : Object.entries(args)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
  useSkyStore.getState().pushSyscall({ t: Date.now(), name, args: argStr, result });
}
