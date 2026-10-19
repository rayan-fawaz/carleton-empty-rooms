import { Star } from "lucide-react";
import type { Placed } from "@/lib/rooms";
import { formatTime } from "@/lib/time";
import { statusTone, toneBar } from "./Status";

export function SavedRooms({ saved, onOpen }: { saved: Placed[]; onOpen: (id: string) => void }) {
  return (
    <>
      <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden /> Your saved rooms
      </h2>
      <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {saved.map((p) => (
          <li key={p.room.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onOpen(p.room.id)}
              className="flex items-center gap-2.5 rounded-2xl bg-surface py-2 pr-3.5 pl-2 text-left shadow-card hover:bg-surface-2"
            >
              <span className={`h-8 w-1 rounded-full ${toneBar[statusTone(p)]}`} aria-hidden />
              <span>
                <span className="block text-sm font-bold">{p.room.name}</span>
                <span className="block text-xs text-muted">{summary(p)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function summary({ status }: Placed): string {
  if (!status.free) return `In use until ${formatTime(status.until)}`;
  return status.restOfDay ? "Free rest of day" : `Free until ${formatTime(status.until)}`;
}
