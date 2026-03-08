// types.ts — Shared Types for Card Generation Pipeline

export interface UserInput {
  character_name: string;
  source_media: string;
  media_type: "book" | "anime" | "game" | "movie" | "series" | "other";
  resonance_text: string; // max 800 chars
  aesthetic_preference?: "dark" | "light" | "ethereal" | "brutal" | "warm" | "cold" | "neutral";
  mood_tags?: string[];
}

// ─── Individual Agent Outputs ────────────────────────────────────────────────

export interface AnalystOutput {
  character_archetype: string;
  user_emotional_lens: string; // what emotion drives the user's connection
  core_contradiction: string; // character's main tension
  psychological_traits: string[]; // 4-6 single words
  projection_note: string; // what the user is projecting vs observing
}

export interface PoetOutput {
  key_phrase: string; // ≤ 12 words, aphorism style
  verse: string[]; // 2-4 lines
  tone_note: string; // internal: e.g. "grief-adjacent, not mournful"
}

export interface ArtDirectorOutput {
  base_prompt: string;
  negative_prompt: string;
  style_tags: string[];
  composition_note: string;
  lighting_style: string;
}

export interface PaletteOutput {
  hex_codes: string[]; // exactly 5
  palette_name: string;
  dominant_mood?: string;
  background_hex: string;
  text_primary_hex: string;
  text_accent_hex: string; // typically warm/yellow for verse contrast
}

export interface MusicOutput {
  search_query: string; // Spotify search string
  genre_tags: string[];
  tempo: "slow" | "mid" | "upbeat";
  mood_descriptor: string;
  era_hint: string;
}

// ─── Assembled Card Data ─────────────────────────────────────────────────────

export interface CardData {
  character_name: string;
  source_media: string;
  // From agents
  key_phrase: string;
  verse: string[];
  traits: string[];
  visual_prompt: string;
  color_palette: PaletteOutput;
  music: MusicOutput;
  // From external APIs
  spotify_track?: SpotifyTrack;
  image_url?: string; // Replicate/fal.ai result
  qr_svg?: string; // QR code SVG string
  // Meta
  date_generated: string;
  card_id: string;
}

export interface SpotifyTrack {
  name: string;
  artist: string;
  url: string;
  uri: string;
  preview_url?: string;
  album_art?: string;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface GenerateResponse {
  success: boolean;
  card_id?: string;
  card_data?: CardData;
  svg_string?: string;
  error?: string;
}

// ─── Pipeline Config ─────────────────────────────────────────────────────────

export type PipelineMode = "sequential" | "parallel";

export interface PipelineConfig {
  mode: PipelineMode;
  skip_image_gen?: boolean; // for dev/testing
  skip_spotify?: boolean;   // for dev/testing
  cache_enabled?: boolean;
}
