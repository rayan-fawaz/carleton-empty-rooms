import { formatDuration, formatTime } from "@/lib/time";
import type { Placed } from "@/lib/view";

type Tone = "free" | "short" | "busy";

/** Plain-language status: what the room is doing and when that changes. */
export function describe({ status, usable }: Placed): { tone: Tone; label: string; detail: string } {
  if (!status.free) return { tone: "busy", label: "In use", detail: `Free at ${formatTime(status.until)}` };
  const restOfDay = status.nextTitle === null;
  if (!usable) {
    return { tone: "short", label: `Free for ${formatDuration(status.minutesLeft)}`, detail: `Booked at ${formatTime(status.until)}` };
  }
  return restOfDay
    ? { tone: "free", label: "Free rest of day", detail: "Nothing else booked" }
    : { tone: "free", label: `Free for ${formatDuration(status.minutesLeft)}`, detail: `Until ${formatTime(status.until)}` };
}

const tones: Record<Tone, string> = {
  free: "bg-free-soft text-free",
  short: "bg-short-soft text-short",
  busy: "bg-busy-soft text-busy",
};

export function StatusBadge({ placed, size = "sm" }: { placed: Placed; size?: "sm" | "lg" }) {
  const { tone, label, detail } = describe(placed);
  return (
    <div className={size === "lg" ? "flex flex-wrap items-center gap-x-3 gap-y-1" : "flex flex-wrap items-center gap-x-2 gap-y-0.5"}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${tones[tone]} ${
          size === "lg" ? "px-3 py-1.5 text-base" : "px-2.5 py-0.5 text-[13px]"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        {label}
      </span>
      <span className={`tabular whitespace-nowrap text-muted ${size === "lg" ? "text-sm" : "text-xs"}`}>{detail}</span>
    </div>
  );
}
