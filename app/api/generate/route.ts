// app/api/generate/route.ts
// Next.js App Router API route — main card generation endpoint
//
// POST /api/generate — generate a card
// GET  /api/generate — health check + usage stats
//
// Cost guards:
//   - Global daily cap (DAILY_CARD_LIMIT env var, default 50)
//   - Per-IP rate limit (3 cards/hour)
//   - API key validation (fail fast)

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runCardPipeline } from "../../../lib/orchestrator";
import { buildCardSVG } from "../../../lib/svg-builder";
import type { GenerateResponse, UserInput } from "../../../types";

// ── Config ───────────────────────────────────────────────────────────────────

const PIPELINE_MODE = (process.env.PIPELINE_MODE ?? "sequential") as
  | "sequential"
  | "parallel";

export const maxDuration = 120;

// ── Input validation ─────────────────────────────────────────────────────────

const UserInputSchema = z.object({
  character_name: z
    .string()
    .min(1, "Character name required")
    .max(100)
    .transform((s) => s.trim()),
  source_media: z
    .string()
    .min(1, "Source media required")
    .max(200)
    .transform((s) => s.trim()),
  media_type: z.enum(["book", "anime", "game", "movie", "series", "other"]),
  resonance_text: z
    .string()
    .min(20, "Tell us a bit more (at least 20 characters)")
    .max(800, "Please keep to 800 characters")
    .transform((s) => sanitizeResonanceText(s.trim())),
  aesthetic_preference: z
    .enum(["dark", "light", "ethereal", "brutal", "warm", "cold", "neutral"])
    .optional(),
  mood_tags: z.array(z.string().max(30)).max(6).optional(),
});

// ── Rate Limiting ────────────────────────────────────────────────────────────
// Per-IP: 3 cards per hour (prevents abuse from single user)
// In-memory — resets on cold start (acceptable for Vercel hobby)

const PER_IP_LIMIT = 3;
const PER_IP_WINDOW = 60 * 60 * 1000; // 1 hour

const ipCounts = new Map<string, { count: number; resetAt: number }>();

function checkIPLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = ipCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + PER_IP_WINDOW });
    return { allowed: true, remaining: PER_IP_LIMIT - 1 };
  }

  if (entry.count >= PER_IP_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: PER_IP_LIMIT - entry.count };
}

// ── Global Daily Cap ─────────────────────────────────────────────────────────
// Hard ceiling on total cards generated per day across ALL users.
// Configurable via DAILY_CARD_LIMIT env var (default: 50)
// This is your primary cost protection.

const DAILY_LIMIT = Number.parseInt(process.env.DAILY_CARD_LIMIT ?? "50", 10);

let dailyCount = 0;
let dailyResetAt = getNextMidnight();

function getNextMidnight(): number {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  return tomorrow.getTime();
}

function checkDailyLimit(): { allowed: boolean; remaining: number } {
  const now = Date.now();

  // Reset at midnight
  if (now > dailyResetAt) {
    dailyCount = 0;
    dailyResetAt = getNextMidnight();
  }

  if (dailyCount >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  dailyCount++;
  return { allowed: true, remaining: DAILY_LIMIT - dailyCount };
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
): Promise<NextResponse<GenerateResponse>> {
  const startTime = Date.now();

  // ── API key check — fail fast ──
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Server not configured. Missing GROQ API key." },
      { status: 503 },
    );
  }

  // ── Client IP ──
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  // ── Global daily cap check ──
  const daily = checkDailyLimit();
  if (!daily.allowed) {
    console.warn(`[Generate] Daily limit hit (${DAILY_LIMIT} cards/day)`);
    return NextResponse.json(
      {
        success: false,
        error: "Daily generation limit reached. Please try again tomorrow!",
      },
      {
        status: 429,
        headers: {
          "X-DailyLimit-Remaining": "0",
          "Retry-After": Math.ceil(
            (dailyResetAt - Date.now()) / 1000,
          ).toString(),
        },
      },
    );
  }

  // ── Per-IP rate limit check ──
  const ipLimit = checkIPLimit(ip);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "You've generated too many cards. Try again in an hour!",
      },
      {
        status: 429,
        headers: { "X-RateLimit-Remaining": "0" },
      },
    );
  }

  // ── Parse body ──
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // ── Validate input ──
  const parsed = UserInputSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { success: false, error: firstIssue.message },
      { status: 400 },
    );
  }

  const input: UserInput = parsed.data;

  try {
    console.log(
      `[Generate] Card #${dailyCount}/${DAILY_LIMIT} for "${input.character_name}" (${input.media_type}) | IP: ${ip} | Mode: ${PIPELINE_MODE}`,
    );

    // ── Run the subagent pipeline ──
    const cardData = await runCardPipeline(input, {
      mode: PIPELINE_MODE,
      skip_image_gen: process.env.SKIP_IMAGE_GEN === "true",
      skip_spotify: process.env.SKIP_SPOTIFY === "true",
    });

    // ── Build SVG card ──
    const svgString = buildCardSVG(cardData);

    const elapsed = Date.now() - startTime;
    console.log(
      `[Generate] ✓ Card ${cardData.card_id} done in ${elapsed}ms | Daily: ${dailyCount}/${DAILY_LIMIT} | IP remaining: ${ipLimit.remaining}`,
    );

    return NextResponse.json(
      {
        success: true,
        card_id: cardData.card_id,
        card_data: cardData,
        svg_string: svgString,
      } as GenerateResponse,
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": ipLimit.remaining.toString(),
          "X-DailyLimit-Remaining": daily.remaining.toString(),
          "X-Generation-Time-Ms": elapsed.toString(),
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("[Generate] Pipeline error:", err);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// ── GET: Health check + usage stats ──────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    pipeline_mode: PIPELINE_MODE,
    version: "1.0.0",
    usage: {
      daily_count: dailyCount,
      daily_limit: DAILY_LIMIT,
      daily_remaining: Math.max(0, DAILY_LIMIT - dailyCount),
    },
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sanitizeResonanceText(text: string): string {
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
    /you\s+are\s+now\s+/gi,
    /disregard\s+your\s+/gi,
    /system\s*:/gi,
    /\[INST\]/gi,
    /<\|im_start\|>/gi,
    /###\s*instruction/gi,
  ];

  let sanitized = text;
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[removed]");
  }

  return sanitized;
}
