import { ImageResponse } from "next/og";
import { DoorIcon } from "./apple-icon";

export const alt = "Empty Rooms: find a free classroom at Carleton";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const rooms = [
  { name: "SA 513", note: "Free for 2h 30m" },
  { name: "TB 238", note: "Free rest of day" },
  { name: "LA C164", note: "Free for 1h 15m" },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f6f5f1", padding: 72, color: "#17181c" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", width: 88, height: 88, borderRadius: 24, background: "#0e8a5d", alignItems: "center", justifyContent: "center" }}>
              <DoorIcon size={52} />
            </div>
            <div style={{ fontSize: 44, fontWeight: 800 }}>Empty Rooms</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Find a free classroom at Carleton.</div>
            <div style={{ fontSize: 30, color: "#696b74", marginTop: 20 }}>Live room schedules, by building. Go study.</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, marginLeft: 56, flex: 1 }}>
          {rooms.map((r) => (
            <div key={r.name} style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 24, padding: "24px 28px", boxShadow: "0 4px 16px rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: 34, fontWeight: 800 }}>{r.name}</div>
              <div style={{ display: "flex", marginTop: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#0e8a5d", background: "#e2f3eb", borderRadius: 999, padding: "6px 16px" }}>{r.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
