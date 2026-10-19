import { CloudOff } from "lucide-react";
import { connection } from "next/server";
import { getDay } from "@/lib/data";
import { readViewState } from "@/lib/state";
import { ottawaNow } from "@/lib/time";
import { Finder } from "./Finder";

/** Loads the selected day on the server and hands it to the interactive finder. */
export async function Results({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  await connection();
  const now = ottawaNow();
  const { date } = readViewState(params, now.date);

  const day = await getDay(date).catch((err) => {
    console.error("Booking data unavailable", err);
    return null;
  });
  if (!day) return <Unavailable />;
  return <Finder rooms={day.rooms} today={now.date} serverMinute={now.minute} fetchedAt={day.fetchedAt} />;
}

function Unavailable() {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-3xl bg-surface px-6 py-12 text-center shadow-card">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-busy-soft text-busy">
        <CloudOff className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-bold">Can&apos;t reach Carleton&apos;s booking system</h2>
      <p className="mt-2 text-sm text-muted">
        Room schedules come from booking.carleton.ca, and it isn&apos;t responding right now. This usually clears up in
        a few minutes.
      </p>
      <a href="" className="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg">
        Try again
      </a>
    </div>
  );
}
