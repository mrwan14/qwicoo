import type { MetadataRoute } from "next";

/** Lets staff add Qwicoo to the Home Screen (needed for web push on iPhone and iPad). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Qwicoo",
    short_name: "Qwicoo",
    description: "Qwicoo staff tools and guest ordering.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f5f2ec",
    theme_color: "#252525",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
