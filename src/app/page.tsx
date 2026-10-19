import { DoorOpen } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Results } from "@/components/Results";

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
      <header className="flex items-center justify-between gap-4 pt-5 pb-5 sm:pt-8 sm:pb-7">
        <Link href="/" className="flex items-center gap-3" aria-label="Empty Rooms home">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-brand-ink shadow-card">
            <DoorOpen className="h-6 w-6" strokeWidth={2.2} aria-hidden />
          </span>
          <span>
            <span className="block text-xl leading-tight font-extrabold tracking-tight">Empty Rooms</span>
            <span className="block text-[13px] text-muted">Free classrooms at Carleton, right now</span>
          </span>
        </Link>
        <span className="hidden rounded-full border border-line px-3 py-1 text-xs text-muted sm:inline">Unofficial student tool</span>
      </header>

      <Suspense fallback={<Loading />}>
        <Results searchParams={searchParams} />
      </Suspense>

      <footer className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-muted">
        <p>
          Room schedules come from{" "}
          <a className="underline hover:text-ink" href="https://booking.carleton.ca/index.php?p=RoomSearch&r=1">
            booking.carleton.ca
          </a>
          , photos and room details from{" "}
          <a className="underline hover:text-ink" href="https://carleton.ca/tls/rooms/">
            Carleton TLS
          </a>
          . &ldquo;Free&rdquo; means nothing is booked; rooms can still be locked or used informally. Not affiliated with
          Carleton University.
        </p>
      </footer>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading rooms">
      <div className="h-[52px] animate-pulse rounded-2xl bg-surface shadow-card" />
      <div className="mt-3 flex gap-2">
        {[88, 70, 90, 96, 80].map((w, i) => (
          <div key={i} className="h-9 animate-pulse rounded-full bg-surface shadow-card" style={{ width: w }} />
        ))}
      </div>
      <div className="mt-3 h-10 animate-pulse rounded-full bg-surface shadow-card" />
      <div className="mt-6 space-y-px overflow-hidden rounded-2xl bg-line shadow-card">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 bg-surface px-3.5 py-3">
            <div className="h-9 w-9 animate-pulse rounded-xl bg-surface-2" />
            <div className="h-4 flex-1 animate-pulse rounded bg-surface-2" style={{ maxWidth: 140 + ((i * 37) % 90) }} />
          </div>
        ))}
      </div>
    </div>
  );
}
