// lib/svg-builder.ts
// SVG card builder — follows reference template exactly
// Just slots in data from LLM, no AI layout decisions

import type { CardData } from "../types";

// ─── Date formatter: "Mar'26" style ──────────────────────────────────────────

function formatDate(dateStr: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${months[now.getMonth()]}'${String(now.getFullYear()).slice(2)}`;
  }
  return `${months[d.getMonth()]}'${String(d.getFullYear()).slice(2)}`;
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
  const date = formatDate(card.date_generated);

  // Build verse tspans — center justified, italic
  const verseTspans = card.verse
    .map(
      (line, i) =>
        `<tspan x="540" dy="${i === 0 ? 0 : 32}">${esc(line)}</tspan>`,
    )
    .join("\n      ");

  // Verse block height adapts to content
  const verseBlockH = Math.max(110, card.verse.length * 32 + 40);

  // Palette squares
  const paletteSquares = p.hex_codes
    .map(
      (hex, i) => `<rect x="${i * 36}" width="28" height="28" fill="${hex}"/>`,
    )
    .join("\n      ");

  // Music label
  let musicLabel = "";
  if (card.spotify_track) {
    musicLabel = `<text x="540" y="1155"
        text-anchor="middle"
        font-size="14"
        font-family="Inter, sans-serif"
        fill="#555">${esc(trunc(card.spotify_track.name, 28))} — ${esc(trunc(card.spotify_track.artist, 20))}</text>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1350" viewBox="0 0 1080 1350"
     xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink">

  <defs>
    <style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&amp;family=Inter:wght@300;400;500&amp;display=swap');</style>
    <clipPath id="imgClip">
      <rect x="220" y="170" width="640" height="500"/>
    </clipPath>
  </defs>

  <!-- BACKGROUND -->
  <rect width="1080" height="1350" fill="#f2f2f2"/>

  <!-- MAIN CARD -->
  <rect x="140" y="70" width="800" height="1210"
        fill="white"
        stroke="#dadada"
        stroke-width="2"
        rx="16"/>

  <!-- CHARACTER NAME (aligned with inner square left) -->
  <text x="220" y="130"
        font-size="32"
        font-family="Playfair Display, serif"
        font-weight="700"
        fill="#111">${esc(card.character_name)}</text>

  <!-- SOURCE MEDIA (aligned right with inner square) -->
  <text x="860" y="130"
        text-anchor="end"
        font-size="16"
        font-family="Inter, sans-serif"
        font-weight="300"
        fill="#888"
        letter-spacing="1">${esc(card.source_media)}</text>

  <!-- CHARACTER FRAME -->
  <rect x="220" y="170"
        width="640"
        height="500"
        fill="#fafafa"
        stroke="#cccccc"
        stroke-width="2"/>

  <!-- CHARACTER IMAGE -->
  ${
    hasImg
      ? `<image href="${card.image_url}"
           x="220" y="170"
           width="640" height="500"
           preserveAspectRatio="xMidYMid slice"
           clip-path="url(#imgClip)"/>`
      : `<rect x="220" y="170" width="640" height="500" fill="#e8e8e8"/>
  <text x="540" y="430"
        text-anchor="middle"
        font-size="32"
        font-family="Inter, sans-serif"
        fill="#aaa">Character Art</text>`
  }

  <!-- KEY PHRASE (single line between image and verse) -->
  <text x="540" y="730"
        text-anchor="middle"
        font-size="24"
        font-family="Playfair Display, serif"
        font-style="italic"
        fill="#333">${esc(card.key_phrase)}</text>

  <!-- YELLOW VERSE BLOCK -->
  <rect x="220" y="770"
        width="640"
        height="${verseBlockH}"
        fill="#fff2a8"
        stroke="#e4d17a"
        stroke-width="1"/>

  <text x="540" y="${770 + 34}"
        text-anchor="middle"
        font-size="20"
        font-family="Inter, sans-serif"
        font-style="italic"
        fill="#222">
      ${verseTspans}
  </text>

  <!-- COLOR PALETTE SQUARES (separate, below verse) -->
  <g transform="translate(220,${770 + verseBlockH + 30})">
      ${paletteSquares}
  </g>

  <!-- PALETTE NAME -->
  <text x="220" y="${770 + verseBlockH + 78}"
        font-size="12"
        font-family="Inter, sans-serif"
        font-weight="300"
        fill="#aaa"
        letter-spacing="1">${esc(p.palette_name)}</text>

  <!-- DATE (separate, right aligned) -->
  <text x="860" y="${770 + verseBlockH + 52}"
        text-anchor="end"
        font-size="18"
        font-family="Inter, sans-serif"
        fill="#666">Generated · ${esc(date)}</text>

  <!-- SPOTIFY CIRCLE -->
  <circle cx="540" cy="1100" r="44" fill="#1DB954"/>
  <text x="540" y="1108"
        text-anchor="middle"
        font-size="28"
        fill="white">♪</text>

  ${musicLabel}

  <!-- CARDSOULS WATERMARK -->
  <text x="540" y="1240"
        text-anchor="middle"
        font-size="11"
        font-family="Inter, sans-serif"
        font-weight="300"
        fill="#ccc"
        letter-spacing="4">CARDSOULS</text>

</svg>`;
}

// ─── PNG / JPEG exports ──────────────────────────────────────────────────────

export async function svgToPng(svg: string, scale: 1 | 2 = 1): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(svg), { density: 72 * scale })
    .resize(1080 * scale, 1350 * scale)
    .png({ quality: 95, compressionLevel: 6 })
    .toBuffer();
}

export async function svgToJpeg(svg: string, quality = 88): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(svg), { density: 72 })
    .resize(1080, 1350)
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}
