import { CloudOff } from "lucide-react";
import { connection } from "next/server";
import { getBookings, getRoomInfo, getRooms } from "@/lib/data";
import { isValidDate, ottawaNow } from "@/lib/time";
import type { RoomInfo } from "@/lib/types";
import { type FinderRoom, infoFor } from "@/lib/view";
import { Finder } from "./Finder";

/** Fetches one day of bookings on the server and hands everything to the client-side finder. */
export async function Results({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  await connection();
  const now = ottawaNow();
  const requested = Array.isArray(params.date) ? params.date[0] : params.date;
  const date = isValidDate(requested) ? requested : now.date;

  let data;
  try {
    const [{ rooms, buildings }, { bookings, fetchedAt }, info] = await Promise.all([
      getRooms(),
      getBookings(date),
      getRoomInfo().catch((err): Record<string, RoomInfo> => {
        console.error("TLS room details unavailable", err);
        return {};
      }),
    ]);
    data = { rooms, buildings, bookings, fetchedAt, info };
  } catch (err) {
    console.error("Booking data unavailable", err);
    return <Unavailable />;
  }

  const rooms: FinderRoom[] = data.rooms.map((r) => ({
    ...r,
    buildingName: data.buildings[r.building] ?? r.building,
    bookings: data.bookings[r.id] ?? [],
    info: infoFor(data.info, r.name),
  }));

  return <Finder rooms={rooms} today={now.date} serverMinute={now.minute} fetchedAt={data.fetchedAt} />;
}

function Unavailable() {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-3xl bg-surface px-6 py-12 text-center shadow-card">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-busy-soft text-busy">
        <CloudOff className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-bold">Can&apos;t reach Carleton&apos;s booking system</h2>
      <p className="mt-2 text-sm text-muted">
        We get room schedules from booking.carleton.ca, and it isn&apos;t responding right now. This usually clears up in a
        few minutes.
      </p>
      <a href="" className="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg">
        Try again
      </a>
    </div>
  );
}
