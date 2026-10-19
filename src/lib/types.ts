/** Minutes since local (Ottawa) midnight. */
export type Minute = number;

export type Room = {
  id: string;
  /** Booking-system name, e.g. "TB 238". */
  name: string;
  /** Building code, e.g. "TB". */
  building: string;
};

export type Booking = {
  start: Minute;
  end: Minute;
  /** Event title, or "Occupied" when the booking system hides it. */
  title: string;
};

export type RoomImage = { thumb: string; large: string };

/** Photo and details published by Carleton Teaching and Learning Services (TLS). */
export type RoomInfo = {
  url: string;
  capacity: number | null;
  types: string[];
  accessibility: string[];
  equipment: string[];
  image: RoomImage | null;
};

/** A room together with its bookings for the selected day and its TLS details, if any. */
export type DayRoom = Room & { buildingName: string; bookings: Booking[]; info: RoomInfo | null };

export type RoomStatus =
  { free: true; until: Minute; minutesLeft: number; restOfDay: boolean } | { free: false; until: Minute };
