# Empty Rooms

Find a Carleton University classroom that isn't booked right now, so you can study in it.

**Live:** https://carleton-empty-rooms.vercel.app

Pick a building to see which of its rooms are free and for how long, with photos, seat counts and the day's schedule. You can look ahead to later today or the coming week, ask for rooms that stay free for 1–3 hours, filter by things like outlets at every desk, and save the rooms you like.

This is an unofficial student project, not affiliated with Carleton University. "Free" means nothing is booked in Carleton's system; a room can still be locked.

## How it works

- **Schedules** come from the public room timeline on [booking.carleton.ca](https://booking.carleton.ca/index.php?p=RoomSearch&r=1) (Infosilem Campus Portal). One request returns every room's bookings for a day.
- **Photos, seats and equipment** come from the WordPress API behind [Carleton TLS's room search](https://carleton.ca/tls/rooms/), matched to rooms by room number.
- The server fetches and caches a day at a time (`'use cache: remote'`): bookings for 15 minutes, rooms and TLS details for a day. Carleton's servers see a handful of requests per hour no matter how many people use the site. Only today and the next six days can be requested.
- The browser gets the whole day and does the rest instantly (search, filters, "in 1 hour", minimum duration). The view is kept in the URL, so every screen is a shareable link.

## Development

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests, run against saved real responses
npm run lint       # ESLint + Prettier
npm run typecheck
npm run format     # apply Prettier
```

## Code map

| Path                        | What it does                                                           |
| --------------------------- | ---------------------------------------------------------------------- |
| `src/lib/data.ts`           | Cached fetchers for both Carleton sources                              |
| `src/lib/parse-*.ts`        | Turn raw responses into rooms, bookings and room details               |
| `src/lib/availability.ts`   | Whether a room is free at a given minute, and the day's free stretches |
| `src/lib/rooms.ts`          | Filtering, search, ranking and per-building counts                     |
| `src/lib/state.ts`          | The view state and its URL encoding                                    |
| `src/components/Finder.tsx` | The interactive app; other components are its pieces                   |

Built with Next.js 16, React 19, TypeScript and Tailwind CSS 4. Deployed on Vercel.
