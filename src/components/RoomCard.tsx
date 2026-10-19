import { Star, Users } from "lucide-react";
import type { CSSProperties } from "react";
import { type Placed, shortBuildingName } from "@/lib/rooms";
import { RoomPhoto } from "./RoomPhoto";
import { StatusBadge } from "./Status";

/** Cards likely to be on screen at first paint. */
const EAGER_CARDS = 4;

export function RoomCard({
  placed,
  index,
  starred,
  onOpen,
  onStar,
  showBuilding = true,
}: {
  placed: Placed;
  index: number;
  starred: boolean;
  onOpen: () => void;
  onStar: () => void;
  showBuilding?: boolean;
}) {
  const { room, usable } = placed;
  const seats = room.info?.capacity;

  return (
    <li className="fade-up relative" style={{ "--i": index } as CSSProperties}>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full gap-3 rounded-2xl bg-surface p-2.5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:flex-col sm:gap-0 sm:p-0 ${
          usable ? "" : "opacity-75"
        }`}
      >
        <RoomPhoto
          room={room}
          size="thumb"
          eager={index < EAGER_CARDS}
          className="aspect-[4/3] w-28 shrink-0 rounded-xl sm:aspect-[3/2] sm:w-full sm:rounded-none sm:rounded-t-2xl"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 pr-10 sm:p-3.5 sm:pr-12">
          <div className="min-w-0">
            <p className="truncate text-[17px] leading-tight font-bold tracking-tight">{room.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-muted">
              {showBuilding && <span className="truncate">{shortBuildingName(room.buildingName)}</span>}
              {showBuilding && seats ? <span aria-hidden>·</span> : null}
              {seats ? (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {seats} seats
                </span>
              ) : null}
            </p>
          </div>
          <StatusBadge placed={placed} />
        </div>
      </button>
      <button
        type="button"
        onClick={onStar}
        aria-pressed={starred}
        aria-label={starred ? `Remove ${room.name} from saved rooms` : `Save ${room.name}`}
        className="absolute top-1 right-1 grid h-11 w-11 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink sm:top-auto sm:right-1.5 sm:bottom-1.5"
      >
        <Star className={`h-[18px] w-[18px] ${starred ? "fill-amber-400 text-amber-500" : ""}`} />
      </button>
    </li>
  );
}
