// lib/agents.ts
// CardSouls — Single combined LLM call via Groq (Llama 3.3 70B)
//
// ONE call returns: key_phrase, verse, traits, art_prompt, music_query
// Groq free tier: 30 RPM, 14,400 RPD — massively generous

import type { UserInput } from "../types";

// ─── Config ──────────────────────────────────────────────────────────────────

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

// ─── Combined output type ────────────────────────────────────────────────────

export interface CombinedAgentOutput {
  key_phrase: string;
  verse: string[];
  traits: string[];
  art_prompt: string;
  music_query: string;
}

// ─── Retry helper ────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── System prompt ───────────────────────────────────────────────────────────

const COMBINED_SYSTEM = `You are CardSouls — an AI that generates aesthetic collectible card content for fictional characters.

Given a character name, source media, media type, the user's emotional resonance text, and optional aesthetic/mood preferences, return a JSON object with ALL of the following fields:

1. "key_phrase" — A short, poetic phrase (5-10 words) capturing the character's emotional essence. Make it feel inevitable, not generic.

2. "verse" — An array of 3-5 short lines of evocative poetry. Each line is a separate string. Do NOT rhyme. Use imagery, metaphor, and emotional precision.

3. "traits" — An array of exactly 5 single-word psychological/emotional traits (e.g., "defiant", "fractured", "devoted"). Lowercase only.

4. "art_prompt" — A detailed image generation prompt. Describe the character physically (hair, eyes, expression, clothing, posture) WITHOUT using their real name. Include: subject + lighting + environment + art style + quality tags.

5. "music_query" — A search query for finding a matching song. Format: "artist_name song_title". Pick a real song that emotionally matches.

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- key_phrase must be under 60 characters
- verse lines should be 4-12 words each
- traits must be exactly 5 single lowercase words
- art_prompt must NOT contain the character's real name`;

// ─── The single API call ─────────────────────────────────────────────────────

export async function runCombinedAgent(
  input: UserInput,
): Promise<CombinedAgentOutput> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const userMessage = JSON.stringify({
    character_name: input.character_name,
    source_media: input.source_media,
    media_type: input.media_type,
    resonance_text: input.resonance_text,
    aesthetic_preference: input.aesthetic_preference ?? "neutral",
    mood_tags: input.mood_tags ?? [],
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
        console.log(
          `[CardSouls] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`,
        );
        await sleep(delay);
      }

      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: COMBINED_SYSTEM },
            { role: "user", content: userMessage },
          ],
          temperature: 0.8,
          max_tokens: 1200,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Groq API ${res.status}: ${errBody.slice(0, 300)}`);
      }

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content ?? "";
      const clean = raw.replace(/```json\n?|\n?```/g, "").trim();

      try {
        return validateOutput(JSON.parse(clean));
      } catch {
        const match = clean.match(/\{[\s\S]*\}/);
        if (match) return validateOutput(JSON.parse(match[0]));
        throw new Error(`Parse failure. Raw: ${raw.slice(0, 300)}`);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRateLimit =
        lastError.message.includes("429") ||
        lastError.message.includes("rate_limit");
      if (!isRateLimit || attempt === MAX_RETRIES) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Agent call failed after retries");
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateOutput(data: Record<string, unknown>): CombinedAgentOutput {
  return {
    key_phrase:
      typeof data.key_phrase === "string"
        ? data.key_phrase.slice(0, 60)
        : "Echoes of the unnamed",
    verse: Array.isArray(data.verse)
      ? (data.verse as string[]).slice(0, 5)
      : ["Words lost to the wind"],
    traits: Array.isArray(data.traits)
      ? (data.traits as string[]).slice(0, 5).map((t) => t.toLowerCase())
      : ["unknown", "silent", "distant", "fractured", "searching"],
    art_prompt:
      typeof data.art_prompt === "string"
        ? data.art_prompt
        : "portrait of a mysterious figure",
    music_query:
      typeof data.music_query === "string"
        ? data.music_query
        : "ambient atmospheric",
  };
}
