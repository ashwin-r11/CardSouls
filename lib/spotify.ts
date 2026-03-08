// lib/spotify.ts
// Music track search via Deezer API (free, no auth)
// Named spotify.ts to preserve existing imports across the codebase
// Returns SpotifyTrack type for compatibility with SVG builder + frontend

import type { SpotifyTrack } from "../types";

// Deezer API response type
interface DeezerTrack {
  id: number;
  title: string;
  artist: { name: string };
  album: { cover_medium: string };
  preview: string;
  link: string;
  rank: number;
}

interface DeezerSearchResponse {
  data: DeezerTrack[];
  total: number;
}

export async function fetchSpotifyTrack(
  searchQuery: string,
): Promise<SpotifyTrack | undefined> {
  try {
    const encoded = encodeURIComponent(searchQuery);

    const res = await fetch(
      `https://api.deezer.com/search?q=${encoded}&limit=5`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) {
      console.warn(`[Music] Deezer search returned ${res.status}`);
      return undefined;
    }

    const data: DeezerSearchResponse = await res.json();
    if (!data.data?.length) return undefined;

    // Score: prefer tracks with higher rank (popularity)
    const sorted = [...data.data].sort((a, b) => b.rank - a.rank);
    const best = sorted[0];

    return {
      name: best.title,
      artist: best.artist.name,
      url: best.link,
      uri: `deezer:track:${best.id}`,
      preview_url: best.preview || undefined,
      album_art: best.album.cover_medium || undefined,
    };
  } catch (err) {
    console.error("[Music] Deezer search failed:", err);
    return undefined;
  }
}
