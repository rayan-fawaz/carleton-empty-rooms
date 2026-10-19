import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Empty Rooms · Carleton",
    short_name: "Empty Rooms",
    description: "Find a free classroom at Carleton to study in, right now.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f1",
    theme_color: "#0e8a5d",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
