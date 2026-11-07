import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tamurt Market",
    short_name: "Tamurt Market",
    description: "Acheter et vendre entre particuliers et professionnels, en France et en Algérie.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8faf8",
    theme_color: "#126b50",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
