// lib/svg-builder.ts
// SVG card builder — matches demo_card.svg template

import type { CardData } from "../types";

// ─── Date formatter: "8 Mar '26" style ─────────────────────────────────────

function formatDate(): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  return `${now.getDate()} ${months[now.getMonth()]} '${String(now.getFullYear()).slice(2)}`;
}

// ─── Color helpers ───────────────────────────────────────────────────────────

// Lighten a hex color toward white by a factor (0-1)
function lightenHex(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const r = Math.min(255, Math.round(Number.parseInt(h.slice(0, 2), 16) + (255 - Number.parseInt(h.slice(0, 2), 16)) * factor));
  const g = Math.min(255, Math.round(Number.parseInt(h.slice(2, 4), 16) + (255 - Number.parseInt(h.slice(2, 4), 16)) * factor));
  const b = Math.min(255, Math.round(Number.parseInt(h.slice(4, 6), 16) + (255 - Number.parseInt(h.slice(4, 6), 16)) * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─── XML escape ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function trunc(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildCardSVG(card: CardData): string {
  const p = card.color_palette;
  const hasImg = !!card.image_url;
  const date = formatDate();

  // Dynamic pill width: ~7px per char + 20px padding
  const seriesText = trunc(card.source_media.toUpperCase(), 20);
  const pillWidth = Math.max(60, seriesText.length * 7 + 20);
  const pillCenterX = 20 + pillWidth / 2;

  // Song title: prefer Deezer data, fallback to LLM query
  const songTitle = card.spotify_track?.name ?? card.music?.search_query ?? "";
  const songArtist = card.spotify_track?.artist ?? "";

  // Palette squares (14x14, 18px horizontal spacing)
  const paletteSquares = p.hex_codes
    .map(
      (hex, i) =>
        `<rect x="${28 + i * 18}" y="389" width="14" height="14" rx="3.5" fill="${hex}"/>`,
    )
    .join("\n    ");

  // Verse tspans — wider spacing (dy=28 for breathing room)
  const VERSE_START_Y = 440;
  const VERSE_LINE_H = 28;
  const verseTspans = card.verse
    .map(
      (line, i) =>
        `<tspan x="210" ${i === 0 ? `y="${VERSE_START_Y}"` : `dy="${VERSE_LINE_H}"`}>${esc(line)}</tspan>`,
    )
    .join("\n      ");

  // Closing quote Y position based on verse line count
  const closingQuoteY = VERSE_START_Y + (card.verse.length - 1) * VERSE_LINE_H + 8;

  // Song title Y — below the verse + quote
  const songY = closingQuoteY + 30;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 620" width="420" height="620" font-family="Georgia, 'Times New Roman', serif">
  <defs>
    <!-- Card shadow -->
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000" flood-opacity="0.35"/>
    </filter>

    <!-- Gradient: card background — tinted by character palette -->
    <linearGradient id="cardBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lightenHex(p.hex_codes[0] ?? '#1a1a2e', 0.92)}"/>
      <stop offset="100%" stop-color="${lightenHex(p.hex_codes[1] ?? '#16213e', 0.88)}"/>
    </linearGradient>

    <!-- Gradient: image area bg -->
    <linearGradient id="imgBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${lightenHex(p.hex_codes[0] ?? '#1a1a2e', 0.82)}"/>
      <stop offset="100%" stop-color="${lightenHex(p.hex_codes[1] ?? '#16213e', 0.75)}"/>
    </linearGradient>

    <!-- Subtle corner decoration gradient — uses accent color -->
    <radialGradient id="cornerDeco" cx="0%" cy="0%" r="100%">
      <stop offset="0%" stop-color="${p.text_accent_hex}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="${p.text_accent_hex}" stop-opacity="0"/>
    </radialGradient>

    <!-- Clip for card shape -->
    <clipPath id="cardClip">
      <rect x="0" y="0" width="420" height="620" rx="28" ry="28"/>
    </clipPath>

    <!-- Clip for image area -->
    <clipPath id="imgClip">
      <rect x="20" y="66" width="380" height="285" rx="14" ry="14"/>
    </clipPath>

    <!-- Dotted pattern for image placeholder -->
    <pattern id="dotPattern" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="6" cy="6" r="1.2" fill="#B0A898" fill-opacity="0.45"/>
    </pattern>
  </defs>

  <!-- ═══════════════════════════════════════
       CARD BODY
  ═══════════════════════════════════════ -->
  <g filter="url(#cardShadow)">
    <!-- Card base -->
    <rect x="0" y="0" width="420" height="620" rx="28" ry="28" fill="url(#cardBg)"/>

    <!-- Top-left decorative corner radial wash -->
    <rect x="0" y="0" width="180" height="180" rx="28" ry="0" fill="url(#cornerDeco)" clip-path="url(#cardClip)"/>

    <!-- ── HEADER ZONE ── -->
    <!-- Series tag / category pill (top-left) — dynamic width -->
    <rect x="20" y="16" width="${pillWidth}" height="22" rx="11" fill="#2C2C2C"/>
    <text x="${pillCenterX}" y="31.5" text-anchor="middle" font-family="'Courier New', monospace" font-size="9.5" font-weight="700" fill="#E8C840" letter-spacing="1.2">${esc(seriesText)}</text>

    <!-- CHARACTER NAME — top right, bold serif -->
    <text x="400" y="33" text-anchor="end" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-weight="700" fill="#1A1A1A" letter-spacing="0.3">${esc(card.character_name)}</text>

    <!-- Thin separator under header -->
    <line x1="20" y1="52" x2="400" y2="52" stroke="#D5CFC4" stroke-width="1" stroke-dasharray="3 4"/>

    <!-- ── IMAGE ZONE ── -->
    <!-- Image frame shadow inset -->
    <rect x="20" y="62" width="380" height="293" rx="16" fill="#C4BCAF" opacity="0.4"/>
    <!-- Image area background -->
    <rect x="20" y="66" width="380" height="285" rx="14" fill="url(#imgBg)" clip-path="url(#imgClip)"/>
    <!-- Dot texture inside image area -->
    <rect x="20" y="66" width="380" height="285" rx="14" fill="url(#dotPattern)" clip-path="url(#imgClip)"/>

    ${hasImg ? `
    <image href="${card.image_url}" x="20" y="66" width="380" height="285" preserveAspectRatio="xMidYMid slice" clip-path="url(#imgClip)"/>
    ` : `
    <!-- Center "Character Art" placeholder label -->
    <text x="210" y="205" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#9E9484" font-style="italic" opacity="0.7">Character Art</text>
    <rect x="120" y="185" width="180" height="40" rx="6" fill="none" stroke="#B0A898" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.5"/>
    `}

    <!-- Image frame border -->
    <rect x="20" y="66" width="380" height="285" rx="14" fill="none" stroke="#C2B89E" stroke-width="1.8"/>

    <!-- ── METADATA STRIP (below image) ── -->
    <rect x="20" y="357" width="380" height="28" rx="0" fill="${lightenHex(p.hex_codes[0] ?? '#1a1a2e', 0.85)}"/>
    <rect x="20" y="357" width="380" height="1" fill="${lightenHex(p.hex_codes[0] ?? '#1a1a2e', 0.75)}"/>
    <rect x="20" y="385" width="380" height="1" fill="${lightenHex(p.hex_codes[0] ?? '#1a1a2e', 0.75)}"/>

    <!-- Color palette swatches -->
    <g transform="translate(0,-25)">
    ${paletteSquares}
    </g>

    <!-- "Generated • Date" label -->
    <text x="394" y="375" text-anchor="end" font-family="'Courier New', monospace" font-size="9" fill="#8C8070" letter-spacing="0.8">Generated &#x2022; ${esc(date)}</text>

    <!-- ── KEY PHRASE — bold, fancy, centered ── -->
    <text x="210" y="410" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="14" font-weight="700" fill="#1A1A1A" letter-spacing="0.5">&#x201C;${esc(card.key_phrase)}&#x201D;</text>

    <!-- ── VERSE AREA — wider spacing ── -->
    <!-- Open quote mark -->
    <text x="22" y="${VERSE_START_Y + 5}" font-family="Georgia, serif" font-size="40" fill="${p.text_accent_hex}" opacity="0.55" font-style="italic">&#x201C;</text>

    <!-- Verse text — centered, italic serif, spread out -->
    <text text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="13" font-style="italic" fill="#3A3530" letter-spacing="0.3">
      ${verseTspans}
    </text>

    <!-- Close quote mark -->
    <text x="398" y="${closingQuoteY}" text-anchor="end" font-family="Georgia, serif" font-size="40" fill="${p.text_accent_hex}" opacity="0.55" font-style="italic">&#x201D;</text>

    <!-- ── SONG TITLE ── -->
    ${songTitle ? `
    <text x="210" y="${songY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="11" font-style="italic" fill="${p.text_accent_hex}" letter-spacing="0.5">&#x266B; ${esc(trunc(songTitle, 35))}</text>
    ${songArtist ? `<text x="210" y="${songY + 15}" text-anchor="middle" font-family="'Courier New', monospace" font-size="8.5" fill="${lightenHex(p.hex_codes[2] ?? '#666', 0.3)}" letter-spacing="1">${esc(trunc(songArtist.toUpperCase(), 25))}</text>` : ''}
    ` : ''}

    <!-- ── BORDERS ── -->
    <rect x="0" y="0" width="420" height="620" rx="28" ry="28" fill="none" stroke="${lightenHex(p.hex_codes[0] ?? '#1a1a2e', 0.65)}" stroke-width="1.5"/>
    <rect x="6" y="6" width="408" height="608" rx="23" ry="23" fill="none" stroke="${lightenHex(p.hex_codes[0] ?? '#1a1a2e', 0.80)}" stroke-width="0.8" opacity="0.7"/>
  </g>
</svg>`;
}

// ─── PNG / JPEG exports ──────────────────────────────────────────────────────

export async function svgToPng(svg: string, scale: 1 | 2 = 1): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(svg), { density: 72 * scale })
    .resize(420 * scale, 620 * scale)
    .png({ quality: 95, compressionLevel: 6 })
    .toBuffer();
}

export async function svgToJpeg(svg: string, quality = 88): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(svg), { density: 72 })
    .resize(420, 620)
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}
