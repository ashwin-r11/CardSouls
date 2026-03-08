// app/api/suggest-moods/route.ts
// Deterministic mood suggestions — NO LLM call needed!
// Returns mood tags based on media type + character name patterns

import { type NextRequest, NextResponse } from "next/server";

// ─── Mood presets by media type ──────────────────────────────────────────────

const MOOD_BY_TYPE: Record<string, string[]> = {
  anime: [
    "grief",
    "defiance",
    "devotion",
    "rage",
    "nostalgia",
    "isolation",
    "resilience",
    "obsession",
    "tenderness",
    "chaos",
    "melancholy",
    "rebirth",
  ],
  manga: [
    "grief",
    "defiance",
    "devotion",
    "rage",
    "nostalgia",
    "isolation",
    "resilience",
    "obsession",
    "tenderness",
    "chaos",
    "melancholy",
    "rebirth",
  ],
  game: [
    "determination",
    "sacrifice",
    "solitude",
    "vengeance",
    "loyalty",
    "corruption",
    "hope",
    "regret",
    "power",
    "fractured",
    "haunted",
    "chosen",
  ],
  movie: [
    "longing",
    "betrayal",
    "redemption",
    "obsession",
    "grief",
    "courage",
    "isolation",
    "devotion",
    "chaos",
    "serenity",
    "hunger",
    "fury",
  ],
  series: [
    "transformation",
    "betrayal",
    "ambition",
    "exile",
    "devotion",
    "survival",
    "duality",
    "obsession",
    "fragile",
    "relentless",
    "cunning",
    "shattered",
  ],
  book: [
    "yearning",
    "solitude",
    "wisdom",
    "defiance",
    "devotion",
    "melancholy",
    "wonder",
    "sacrifice",
    "haunted",
    "restless",
    "ancient",
    "ethereal",
  ],
  other: [
    "grief",
    "defiance",
    "tenderness",
    "isolation",
    "rage",
    "nostalgia",
    "devotion",
    "melancholy",
    "chaos",
    "serenity",
    "obsession",
    "resilience",
  ],
};

const DEFAULT_MOODS = MOOD_BY_TYPE.other;

// ─── Shuffle helper (deterministic per character name) ───────────────────────

function seededShuffle(arr: string[], seed: string): string[] {
  const result = [...arr];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }

  for (let i = result.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash + i) | 0;
    const j = Math.abs(hash) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { character_name, source_media, media_type } = await req.json();

    if (!character_name || typeof character_name !== "string") {
      return NextResponse.json({ moods: DEFAULT_MOODS });
    }

    // Pick mood set by media type
    const baseMoods = MOOD_BY_TYPE[media_type ?? "other"] ?? DEFAULT_MOODS;

    // Shuffle based on character name so same character always gets same moods
    const seed = (character_name + (source_media ?? "")).toLowerCase();
    const shuffled = seededShuffle(baseMoods, seed);

    return NextResponse.json({ moods: shuffled.slice(0, 10) });
  } catch {
    return NextResponse.json({ moods: DEFAULT_MOODS });
  }
}
