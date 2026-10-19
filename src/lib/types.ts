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

export type RoomInfo = {
  title: string;
  url: string;
  capacity: number | null;
  types: string[];
  accessibility: string[];
  equipment: string[];
  image: { thumb: string; large: string } | null;
};

export type RoomStatus =
  | { free: true; until: Minute; minutesLeft: number; nextTitle: string | null }
  | { free: false; until: Minute; title: string };
