import { DoorOpen } from "lucide-react";
import Image from "next/image";
import { shortBuildingName } from "@/lib/rooms";
import type { DayRoom } from "@/lib/types";

/** TLS photo of the room, or a quiet placeholder when Carleton hasn't published one. */
export function RoomPhoto({
  room,
  size,
  className = "",
  eager = false,
}: {
  room: DayRoom;
  size: "thumb" | "large";
  className?: string;
  /** Load straight away instead of when scrolled into view (for images visible on first paint). */
  eager?: boolean;
}) {
  const src = room.info?.image?.[size];
  if (!src) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-surface-2 text-muted ${className}`}>
        <DoorOpen className={size === "large" ? "h-10 w-10" : "h-6 w-6"} strokeWidth={1.5} aria-hidden />
        {size === "large" && <span className="text-xs">No photo published for this room</span>}
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
      <Image
        src={src}
        alt={`Inside ${room.name}, ${shortBuildingName(room.buildingName)}`}
        fill
        unoptimized
        loading={eager ? "eager" : "lazy"}
        sizes={size === "thumb" ? "(min-width: 640px) 300px, 112px" : "(min-width: 640px) 544px, 100vw"}
        className="object-cover"
      />
    </div>
  );
}
