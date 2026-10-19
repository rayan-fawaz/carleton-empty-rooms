import type { Placed } from "@/lib/rooms";
import { formatDuration, formatTime } from "@/lib/time";

export type Tone = "free" | "short" | "busy";

/** Free long enough, free but not for long enough, or booked. */
export const statusTone = ({ status, usable }: Placed): Tone => (usable ? "free" : status.free ? "short" : "busy");

export const toneBar: Record<Tone, string> = { free: "bg-free", short: "bg-short", busy: "bg-busy" };
const toneBadge: Record<Tone, string> = {
  free: "bg-free-soft text-free",
  short: "bg-short-soft text-short",
  busy: "bg-busy-soft text-busy",
};

/** What the room is doing and when that changes, in plain words. */
export function describeStatus(placed: Placed): { label: string; detail: string } {
  const { status } = placed;
  if (!status.free) return { label: "In use", detail: `Free at ${formatTime(status.until)}` };
  if (!placed.usable) {
    return { label: `Free for ${formatDuration(status.minutesLeft)}`, detail: `Booked at ${formatTime(status.until)}` };
  }
  if (status.restOfDay) return { label: "Free rest of day", detail: "Nothing else booked" };
  return { label: `Free for ${formatDuration(status.minutesLeft)}`, detail: `Until ${formatTime(status.until)}` };
}

export function StatusBadge({ placed, size = "sm" }: { placed: Placed; size?: "sm" | "lg" }) {
  const { label, detail } = describeStatus(placed);
  const large = size === "lg";
  return (
    <div className={`flex flex-wrap items-center gap-y-0.5 ${large ? "gap-x-3" : "gap-x-2"}`}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${toneBadge[statusTone(placed)]} ${
          large ? "px-3 py-1.5 text-base" : "px-2.5 py-0.5 text-[13px]"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        {label}
      </span>
      <span className={`whitespace-nowrap text-muted tabular-nums ${large ? "text-sm" : "text-xs"}`}>{detail}</span>
    </div>
  );
}
