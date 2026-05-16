import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Sonify — Music Player" },
      { name: "description", content: "A Spotify-like music player with playlists, favorites, and search." },
    ],
  }),
});

function Index() {
  // The full app is vanilla HTML/CSS/JS served from /public/app.html
  useEffect(() => {
    window.location.replace("/app.html");
  }, []);
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#000", color: "#fff" }}>
      <a href="/app.html" style={{ color: "#1db954" }}>Open Sonify →</a>
    </div>
  );
}
