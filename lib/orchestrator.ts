// lib/orchestrator.ts
// CardSouls pipeline — minimized LLM usage
//
// Only 2 API calls per card:
//   1. Combined agent (key_phrase + verse + traits + art_prompt + music_query)
//   2. Image generation (optional)
//
// Everything else is deterministic:
//   - Color palette → preset palettes mapped to aesthetic preference
//   - Music search → Deezer free API (no auth)
//   - QR code → npm qrcode library
//   - Card assembly → SVG template

import crypto from "node:crypto";
import type {
  CardData,
  PaletteOutput,
  SpotifyTrack,
  UserInput,
} from "../types";
import type { CombinedAgentOutput } from "./agents";
import { runCombinedAgent } from "./agents";
import { generateImage } from "./image-gen";
import { generateQRCode } from "./qr";
import { fetchSpotifyTrack } from "./spotify";

// ─── Config ──────────────────────────────────────────────────────────────────

interface PipelineConfig {
  mode: "sequential" | "parallel";
  skip_image_gen?: boolean;
  skip_spotify?: boolean;
}

// ─── Deterministic Palette Generator ─────────────────────────────────────────
// No LLM needed — maps aesthetic preference to curated palettes

const PALETTE_PRESETS: Record<string, PaletteOutput> = {
  dark: {
    hex_codes: ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#533483"],
    palette_name: "Midnight Ember",
    background_hex: "#0a0a12",
    text_primary_hex: "#e8e6e1",
    text_accent_hex: "#e94560",
  },
  light: {
    hex_codes: ["#fefefe", "#f0ece2", "#dfd3c3", "#c7b198", "#596e79"],
    palette_name: "Ivory Dawn",
    background_hex: "#faf8f5",
    text_primary_hex: "#2c2c2c",
    text_accent_hex: "#596e79",
  },
  ethereal: {
    hex_codes: ["#2d1b69", "#573b8a", "#6d44a8", "#8b6cc1", "#c4b7eb"],
    palette_name: "Astral Veil",
    background_hex: "#0f0a1f",
    text_primary_hex: "#e0d8f0",
    text_accent_hex: "#c4b7eb",
  },
  brutal: {
    hex_codes: ["#1a1a1a", "#2d2d2d", "#8b0000", "#cc0000", "#ff4444"],
    palette_name: "Blood Iron",
    background_hex: "#0a0a0a",
    text_primary_hex: "#d4d4d4",
    text_accent_hex: "#ff4444",
  },
  warm: {
    hex_codes: ["#2c1810", "#5c3a2e", "#c4a96d", "#e8c170", "#f4d88e"],
    palette_name: "Amber Glow",
    background_hex: "#120e0a",
    text_primary_hex: "#f0e6d3",
    text_accent_hex: "#c4a96d",
  },
  cold: {
    hex_codes: ["#0a1628", "#1a3a5c", "#2980b9", "#5dade2", "#aed6f1"],
    palette_name: "Frozen Depth",
    background_hex: "#060d17",
    text_primary_hex: "#d4e6f1",
    text_accent_hex: "#5dade2",
  },
  neutral: {
    hex_codes: ["#1c1c1c", "#333333", "#666666", "#999999", "#cccccc"],
    palette_name: "Monochrome Soul",
    background_hex: "#0a0a0a",
    text_primary_hex: "#e0e0e0",
    text_accent_hex: "#999999",
  },
};

function getPalette(aesthetic: string | undefined): PaletteOutput {
  return PALETTE_PRESETS[aesthetic ?? "neutral"] ?? PALETTE_PRESETS.neutral;
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

export async function runCardPipeline(
  input: UserInput,
  config: PipelineConfig,
): Promise<CardData> {
  const date_generated = new Date().toISOString().split("T")[0];
  const card_id = `cs_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

  console.log(
    `[Pipeline] Starting card ${card_id} for "${input.character_name}"`,
  );

  // ── Step 1: ONE Gemini call for all content ──
  console.log(
    "[Pipeline] Step 1: Combined agent call (verse + traits + art prompt)...",
  );
  const agentResult: CombinedAgentOutput = await runCombinedAgent(input);
  console.log("[Pipeline] ✓ Agent returned content");

  // ── Step 2: Deterministic palette (NO LLM) ──
  const palette = getPalette(input.aesthetic_preference);
  console.log(`[Pipeline] ✓ Palette: ${palette.palette_name}`);

  // ── Step 3: External services (image + music) in parallel ──
  console.log("[Pipeline] Step 3: External services...");
  const [imageResult, musicResult] = await Promise.allSettled([
    config.skip_image_gen
      ? Promise.resolve(undefined)
      : generateImage(agentResult.art_prompt),
    config.skip_spotify
      ? Promise.resolve(undefined)
      : fetchSpotifyTrack(agentResult.music_query),
  ]);

  const image_url: string | undefined =
    imageResult.status === "fulfilled" ? imageResult.value : undefined;
  const spotify_track: SpotifyTrack | undefined =
    musicResult.status === "fulfilled" ? musicResult.value : undefined;

  if (imageResult.status === "rejected") {
    console.warn("[Pipeline] Image gen failed:", imageResult.reason);
  }
  if (musicResult.status === "rejected") {
    console.warn("[Pipeline] Music search failed:", musicResult.reason);
  }

  // ── Step 4: QR code (deterministic, npm library) ──
  const qr_svg = await generateQRCode(
    spotify_track?.url ?? "https://www.deezer.com",
  );

  console.log(`[Pipeline] ✓ Card ${card_id} complete`);

  return {
    character_name: input.character_name,
    source_media: input.source_media,
    key_phrase: agentResult.key_phrase,
    verse: agentResult.verse,
    traits: agentResult.traits,
    visual_prompt: agentResult.art_prompt,
    color_palette: palette,
    music: {
      search_query: agentResult.music_query,
      mood_descriptor: agentResult.traits.slice(0, 3).join(" / "),
      genre_tags: ["atmospheric"],
      tempo: "mid" as const,
      era_hint: "modern",
    },
    spotify_track,
    image_url,
    qr_svg,
    date_generated,
    card_id,
  };
}
