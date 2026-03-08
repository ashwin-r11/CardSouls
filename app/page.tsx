"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CardData, GenerateResponse, UserInput } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MEDIA_TYPES = [
  { value: "anime", label: "Anime" },
  { value: "game", label: "Game" },
  { value: "movie", label: "Movie" },
  { value: "series", label: "Series" },
  { value: "book", label: "Book" },
  { value: "other", label: "Other" },
] as const;

const AESTHETICS = [
  { value: "dark", color: "#1a1c1e", label: "Dark" },
  { value: "light", color: "#f0ece4", label: "Light" },
  { value: "ethereal", color: "#c4b8e8", label: "Ethereal" },
  { value: "brutal", color: "#8a1a1a", label: "Brutal" },
  { value: "warm", color: "#c4804a", label: "Warm" },
  { value: "cold", color: "#4a8aaf", label: "Cold" },
  { value: "neutral", color: "#6b6b6b", label: "Neutral" },
] as const;

const DEFAULT_MOODS = [
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
];

const PIPELINE_STEPS = [
  { key: "analyst", label: "Reading your connection...", icon: "🔮" },
  { key: "poet", label: "Finding the words...", icon: "✒️" },
  { key: "artdir", label: "Envisioning the portrait...", icon: "🎨" },
  { key: "palette", label: "Extracting the palette...", icon: "🎭" },
  { key: "music", label: "Matching the score...", icon: "🎵" },
  { key: "assemble", label: "Assembling your card...", icon: "✨" },
];

type AppState = "idle" | "generating" | "done" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  // ── Form state
  const [characterName, setCharacterName] = useState("");
  const [sourceMedia, setSourceMedia] = useState("");
  const [mediaType, setMediaType] = useState<UserInput["media_type"]>("anime");
  const [resonanceText, setResonanceText] = useState("");
  const [aesthetic, setAesthetic] =
    useState<UserInput["aesthetic_preference"]>(undefined);
  const [moodTags, setMoodTags] = useState<string[]>([]);

  // ── Dynamic mood suggestions
  const [moodSuggestions, setMoodSuggestions] =
    useState<string[]>(DEFAULT_MOODS);
  const [loadingMoods, setLoadingMoods] = useState(false);
  const moodTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch character-specific mood tags when character name or source media changes
  useEffect(() => {
    // Clear any existing timer
    if (moodTimerRef.current) clearTimeout(moodTimerRef.current);

    // Need at least a character name to suggest
    if (characterName.trim().length < 3) {
      setMoodSuggestions(DEFAULT_MOODS);
      return;
    }

    // Debounce: wait 2s after user stops typing to conserve API quota
    moodTimerRef.current = setTimeout(async () => {
      setLoadingMoods(true);
      try {
        const res = await fetch("/api/suggest-moods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            character_name: characterName.trim(),
            source_media: sourceMedia.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (Array.isArray(data.moods) && data.moods.length > 0) {
          setMoodSuggestions(data.moods);
          // Clear selected moods that are no longer in the suggestions
          setMoodTags((prev) => prev.filter((t) => data.moods.includes(t)));
        }
      } catch {
        // Silently fall back to defaults
        setMoodSuggestions(DEFAULT_MOODS);
      } finally {
        setLoadingMoods(false);
      }
    }, 2000);

    return () => {
      if (moodTimerRef.current) clearTimeout(moodTimerRef.current);
    };
  }, [characterName, sourceMedia]);

  // ── App state
  const [appState, setAppState] = useState<AppState>("idle");
  const [pipelineStep, setPipelineStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ── Result state
  const [svgString, setSvgString] = useState<string | null>(null);
  const [pngBase64, setPngBase64] = useState<string | null>(null);
  const [cardData, setCardData] = useState<CardData | null>(null);

  // ── Mood tag toggle
  const toggleMood = useCallback((tag: string) => {
    setMoodTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length < 6
          ? [...prev, tag]
          : prev,
    );
  }, []);

  // ── Form validation
  const isValid =
    characterName.trim().length > 0 &&
    sourceMedia.trim().length > 0 &&
    resonanceText.trim().length >= 20 &&
    resonanceText.trim().length <= 800;

  // ── Generate card
  const handleGenerate = useCallback(async () => {
    if (!isValid) return;

    setAppState("generating");
    setError(null);
    setPipelineStep(0);

    // Simulate pipeline step progress (real progress would come from SSE in Tier 2+)
    const stepInterval = setInterval(() => {
      setPipelineStep((prev) => {
        if (prev < PIPELINE_STEPS.length - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 2200);

    try {
      const payload: UserInput = {
        character_name: characterName.trim(),
        source_media: sourceMedia.trim(),
        media_type: mediaType,
        resonance_text: resonanceText.trim(),
        ...(aesthetic && { aesthetic_preference: aesthetic }),
        ...(moodTags.length > 0 && { mood_tags: moodTags }),
      };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: GenerateResponse & { png_base64?: string } = await res.json();

      clearInterval(stepInterval);

      if (!data.success || !data.svg_string) {
        throw new Error(data.error ?? "Generation failed");
      }

      setSvgString(data.svg_string);
      setPngBase64(data.png_base64 ?? null);
      setCardData(data.card_data ?? null);
      setPipelineStep(PIPELINE_STEPS.length);
      setAppState("done");
    } catch (err) {
      clearInterval(stepInterval);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setAppState("error");
    }
  }, [
    isValid,
    characterName,
    sourceMedia,
    mediaType,
    resonanceText,
    aesthetic,
    moodTags,
  ]);

  // ── Download PNG (client-side canvas conversion)
  const handleDownload = useCallback(() => {
    if (!svgString) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 2x resolution for crisp output
    const scale = 2;
    canvas.width = 1080 * scale;
    canvas.height = 1350 * scale;
    ctx.scale(scale, scale);

    const img = new Image();
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Draw rounded rectangle clip for the card only
      const cardX = 140;
      const cardY = 70;
      const cardW = 800;
      const cardH = 1210;
      const r = 16;

      // Fill transparent background
      ctx.clearRect(0, 0, 1080, 1350);

      // Clip to rounded card shape
      ctx.beginPath();
      ctx.moveTo(cardX + r, cardY);
      ctx.lineTo(cardX + cardW - r, cardY);
      ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
      ctx.lineTo(cardX + cardW, cardY + cardH - r);
      ctx.quadraticCurveTo(
        cardX + cardW,
        cardY + cardH,
        cardX + cardW - r,
        cardY + cardH,
      );
      ctx.lineTo(cardX + r, cardY + cardH);
      ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
      ctx.lineTo(cardX, cardY + r);
      ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
      ctx.closePath();
      ctx.clip();

      // Draw the full SVG (clipped to card)
      ctx.drawImage(img, 0, 0, 1080, 1350);

      // Trigger download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cardsouls-${cardData?.card_id ?? "card"}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");

      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      // Fallback: download SVG if canvas fails
      const a = document.createElement("a");
      a.href = url;
      a.download = `cardsouls-${cardData?.card_id ?? "card"}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }, [svgString, cardData]);

  // ── Reset
  const handleReset = useCallback(() => {
    setAppState("idle");
    setSvgString(null);
    setPngBase64(null);
    setCardData(null);
    setError(null);
    setPipelineStep(0);
  }, []);

  // ── Render
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-12 sm:py-20">
      {/* ── Header ── */}
      <header className="mb-12 text-center sm:mb-16">
        <h1
          className="mb-3 text-3xl tracking-tight sm:text-4xl"
          style={{
            fontFamily: "var(--font-display), 'Playfair Display', serif",
          }}
        >
          Card<span style={{ color: "var(--accent)" }}>Souls</span>
        </h1>
        <p
          className="caption mx-auto max-w-md text-sm"
          style={{ color: "var(--muted)" }}
        >
          Turn your emotional connection to a character into an aesthetic
          collectible card.
        </p>
      </header>

      {/* ── Main Content ── */}
      <main className="w-full max-w-xl">
        {/* ════════ IDLE: Form ════════ */}
        {appState === "idle" && (
          <div className="glass-panel float-in p-6 sm:p-8">
            {/* Character Name */}
            <div className="mb-5">
              <label htmlFor="character-name" className="input-label">
                Character
              </label>
              <input
                id="character-name"
                type="text"
                className="input-field"
                placeholder="e.g. Guts, Joel, Oikawa"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Source Media */}
            <div className="mb-5">
              <label htmlFor="source-media" className="input-label">
                From
              </label>
              <input
                id="source-media"
                type="text"
                className="input-field"
                placeholder="e.g. Berserk, The Last of Us, Haikyuu!!"
                value={sourceMedia}
                onChange={(e) => setSourceMedia(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Media Type */}
            <div className="mb-5">
              <span className="input-label">Media Type</span>
              <div className="flex flex-wrap gap-2">
                {MEDIA_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`type-chip ${mediaType === value ? "active" : ""}`}
                    onClick={() => setMediaType(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resonance Text */}
            <div className="mb-5">
              <label htmlFor="resonance-text" className="input-label">
                Why does this character stay with you?
              </label>
              <textarea
                id="resonance-text"
                className="input-field"
                style={{ minHeight: "120px", resize: "vertical" }}
                placeholder="Not a summary. Tell us what this character makes you feel. What about them mirrors something in you? Why can't you let go?"
                value={resonanceText}
                onChange={(e) => setResonanceText(e.target.value)}
                maxLength={800}
              />
              <div
                className={`char-count ${
                  resonanceText.length > 750
                    ? "over-limit"
                    : resonanceText.length > 600
                      ? "near-limit"
                      : ""
                }`}
              >
                {resonanceText.length}/800
              </div>
            </div>

            {/* Aesthetic Preference */}
            <div className="mb-5">
              <span className="input-label">Aesthetic (optional)</span>
              <div className="flex flex-wrap gap-3 items-center">
                {AESTHETICS.map(({ value, color, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`aesthetic-option ${aesthetic === value ? "selected" : ""}`}
                    style={{ background: color }}
                    onClick={() =>
                      setAesthetic((prev) =>
                        prev === value ? undefined : value,
                      )
                    }
                    title={label}
                    aria-label={`${label} aesthetic`}
                  />
                ))}
                {aesthetic && (
                  <span
                    className="caption text-xs"
                    style={{ color: "var(--accent)" }}
                  >
                    {AESTHETICS.find((a) => a.value === aesthetic)?.label}
                  </span>
                )}
              </div>
            </div>

            {/* Mood Tags */}
            <div className="mb-8">
              <span className="input-label">
                Mood Tags (optional, up to 6)
                {loadingMoods && (
                  <span
                    style={{
                      color: "var(--accent)",
                      marginLeft: "8px",
                      fontStyle: "italic",
                      textTransform: "none",
                      letterSpacing: "0",
                    }}
                  >
                    sensing moods...
                  </span>
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                {moodSuggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`mood-tag ${moodTags.includes(tag) ? "selected" : ""}`}
                    onClick={() => toggleMood(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="button"
              id="generate-btn"
              className="btn-primary w-full"
              disabled={!isValid}
              onClick={handleGenerate}
            >
              Generate Card
            </button>

            {!isValid &&
              resonanceText.length > 0 &&
              resonanceText.length < 20 && (
                <p
                  className="mt-3 text-center text-xs"
                  style={{ color: "var(--error)" }}
                >
                  Tell us a bit more — at least 20 characters
                </p>
              )}
          </div>
        )}

        {/* ════════ GENERATING: Pipeline Progress ════════ */}
        {appState === "generating" && (
          <div className="glass-panel float-in p-6 sm:p-8">
            <div className="mb-6 text-center">
              <h2
                className="mb-2 text-xl"
                style={{
                  fontFamily: "var(--font-display), 'Playfair Display', serif",
                }}
              >
                Crafting your card...
              </h2>
              <p className="caption text-xs" style={{ color: "var(--muted)" }}>
                {characterName} • {sourceMedia}
              </p>
            </div>

            <div className="space-y-4">
              {PIPELINE_STEPS.map((step, i) => (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300 ${
                    i <= pipelineStep ? "opacity-100" : "opacity-20"
                  }`}
                  style={{
                    background:
                      i === pipelineStep
                        ? "var(--accent-dim)"
                        : i < pipelineStep
                          ? "rgba(93, 186, 125, 0.05)"
                          : "transparent",
                    borderLeft:
                      i === pipelineStep
                        ? "2px solid var(--accent)"
                        : i < pipelineStep
                          ? "2px solid var(--success)"
                          : "2px solid transparent",
                  }}
                >
                  <span className="text-base">{step.icon}</span>
                  <span
                    className={`text-sm ${
                      i === pipelineStep
                        ? "step-indicator"
                        : i < pipelineStep
                          ? "step-indicator done"
                          : ""
                    }`}
                    style={{
                      fontFamily: "var(--font-body), monospace",
                      color:
                        i < pipelineStep
                          ? "var(--success)"
                          : i === pipelineStep
                            ? "var(--accent)"
                            : "var(--muted)",
                    }}
                  >
                    {step.label}
                  </span>
                  {i < pipelineStep && (
                    <span
                      className="ml-auto text-xs"
                      style={{ color: "var(--success)" }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Shimmer bar */}
            <div
              className="loading-shimmer mt-6 rounded-full"
              style={{ height: "2px" }}
            />
          </div>
        )}

        {/* ════════ DONE: Card Preview ════════ */}
        {appState === "done" && svgString && (
          <div className="float-in">
            {/* Card */}
            <div
              className="card-preview-container mb-6"
              id="card-preview"
              dangerouslySetInnerHTML={{ __html: svgString }}
            />

            {/* Card Meta */}
            {cardData && (
              <div className="glass-panel mb-6 p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h3
                    className="text-base"
                    style={{
                      fontFamily:
                        "var(--font-display), 'Playfair Display', serif",
                      color: "var(--accent)",
                    }}
                  >
                    {cardData.character_name}
                  </h3>
                  <span
                    className="caption text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    {cardData.source_media}
                  </span>
                </div>

                {/* Key phrase */}
                <p
                  className="mb-3 text-sm italic"
                  style={{
                    fontFamily:
                      "var(--font-display), 'Playfair Display', serif",
                    color: "var(--foreground)",
                    opacity: 0.9,
                  }}
                >
                  &ldquo;{cardData.key_phrase}&rdquo;
                </p>

                {/* Traits */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {cardData.traits.map((trait) => (
                    <span
                      key={trait}
                      className="rounded-full px-3 py-1 text-xs"
                      style={{
                        background: "var(--accent-dim)",
                        color: "var(--accent)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {trait}
                    </span>
                  ))}
                </div>

                {/* Palette */}
                <div className="flex items-center gap-2">
                  {cardData.color_palette.hex_codes.map((hex) => (
                    <div
                      key={hex}
                      className="h-4 w-4 rounded-full"
                      style={{
                        background: hex,
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                      title={hex}
                    />
                  ))}
                  <span
                    className="ml-2 text-xs"
                    style={{
                      color: "var(--muted)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {cardData.color_palette.palette_name}
                  </span>
                </div>

                {/* Spotify track */}
                {cardData.spotify_track && (
                  <div
                    className="mt-3 flex items-center gap-2 text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    <span>🎵</span>
                    <a
                      href={cardData.spotify_track.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent)" }}
                    >
                      {cardData.spotify_track.name}
                    </a>
                    <span>—</span>
                    <span>{cardData.spotify_track.artist}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={handleDownload}
              >
                ↓ DOWNLOAD PNG
              </button>
              <button type="button" className="btn-ghost" onClick={handleReset}>
                New Card
              </button>
            </div>
          </div>
        )}

        {/* ════════ ERROR ════════ */}
        {appState === "error" && (
          <div className="glass-panel float-in p-6 text-center sm:p-8">
            <p className="mb-2 text-base" style={{ color: "var(--error)" }}>
              Generation failed
            </p>
            <p
              className="mb-6 text-sm"
              style={{ color: "var(--muted)", fontFamily: "var(--font-body)" }}
            >
              {error}
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                className="btn-primary"
                onClick={handleGenerate}
              >
                Try Again
              </button>
              <button type="button" className="btn-ghost" onClick={handleReset}>
                Start Over
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        className="mt-auto pt-16 pb-6 text-center"
        style={{ color: "var(--muted)" }}
      >
        <p className="caption text-xs">
          CardSouls — your characters, your soul, your card.
        </p>
      </footer>
    </div>
  );
}
