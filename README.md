# Empty Rooms

Find Carleton University classrooms that have no lecture, tutorial or booking right now, so you can study in them. Unofficial student tool.

- **Schedules** come from the public room timeline on [booking.carleton.ca](https://booking.carleton.ca/index.php?p=RoomSearch&r=1) (Infosilem Campus Portal).
- **Photos, seats and equipment** come from the [Carleton TLS](https://carleton.ca/tls/rooms/) room API.
- Responses are cached (`'use cache: remote'`): bookings for 15 minutes per day, rooms and TLS details for a day, so Carleton's servers see a handful of requests per hour.

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # parsers, availability and filter logic, against saved real responses
```

Code map: `src/lib` holds the fetchers (`data.ts`), parsers and pure logic (all unit-tested); `src/components/Finder.tsx` is the client UI, which keeps its state in the URL.
