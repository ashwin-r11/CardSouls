# 📝 My Learning — Building CardSouls

A journal of everything that went wrong, the pivots I made, and what I learned building this project from scratch.

---

## 🏗️ The Original Vision

CardSouls started as an ambitious idea: **5 specialized AI agents**, each doing one thing perfectly:

1. **Analyst** (Claude Haiku) — Extract psychological traits
2. **Poet** (Claude Opus) — Write verse and key phrases
3. **Art Director** (Claude Sonnet) — Generate image prompts
4. **Palette** (Claude Haiku) — Curate color palettes
5. **Music** (Claude Haiku) — Generate music search queries

This was beautiful on paper. In practice? **It was an API cost nightmare.**

---

## 💸 Problem 1: Claude is Expensive

Each card generation made **5 API calls to Anthropic**. Even with Haiku for smaller tasks:
- Opus for poetry alone was eating credits
- Running 5 agents sequentially took ~13 seconds
- The cost per card was unsustainable for a free product

**Lesson:** Premium AI APIs are great for quality but terrible for side projects. Design for cost from day one.

---

## 🔄 Problem 2: The Great Gemini Migration

I decided to swap to **Google's Gemini API** — it has a free tier!

### What went wrong:

**Model naming chaos:**
- `gemini-3.0-flash` → doesn't exist (404 error)
- `gemini-3-flash-preview` → exists but only **20 requests/day** on free tier
- `gemini-3.1-pro-preview` → exists but **0 requests/day** on free tier (requires billing)
- `gemini-2.5-flash` → only **5 requests/minute** on free tier
- `gemini-2.0-flash` → the most generous (15 RPM, 1500 RPD) but I'd already burned through the daily quota from testing

**Rate limit death spiral:**
The mood suggestion endpoint was firing on every keystroke with an 800ms debounce. Combined with 5 agent calls per card, I exhausted every model's daily quota within minutes of testing.

**Lesson:** Always check the ACTUAL rate limits of the specific model ID, not the general "Gemini free tier" marketing page. Preview models have drastically lower limits.

---

## 🎵 Problem 3: Spotify Requires Paid API

Mid-development, I discovered that **Spotify's Web API now requires a paid developer tier** for new applications. The "Create App" page wouldn't even let me check the "Web API" box.

**The pivot:** Swapped to **Deezer's search API** — completely free, no authentication needed, returns track name + artist + album art + preview URL. Kept the same `SpotifyTrack` type name for compatibility (lazy but practical).

**Lesson:** Always verify third-party API pricing BEFORE building against it. Free tiers can disappear.

---

## 🧠 Problem 4: Too Many LLM Calls

Even after switching to Gemini, I was making **5+ API calls per card**:
- 5 agent calls (Analyst, Poet, Art Director, Palette, Music)
- Plus mood suggestion calls on every character name change

The user (correctly) pointed out: **"I want LLM only for img-gen, poem gen, verse gen! After that, stitching into the card is script! Don't ask LLM all!"**

### The fix:
1. **Collapsed 5 agents into 1 combined call** — one prompt that returns key_phrase + verse + traits + art_prompt + music_query in a single JSON response
2. **Made palette generation deterministic** — 7 preset palettes mapped to aesthetic preferences (dark, light, ethereal, brutal, warm, cold, neutral)
3. **Made mood suggestions deterministic** — preset lists per media type with seeded shuffle, zero API calls
4. **Increased debounce** from 800ms to 2000ms

**Result:** From 5+ LLM calls per card → **1 single LLM call**. API usage dropped 80%.

**Lesson:** Every API call should justify its existence. If something can be deterministic, make it deterministic. LLM calls are expensive currency — spend them only where they create real value.

---

## 🚀 Problem 5: The Final Gemini Wall

Even with 1 API call, Gemini's free tier quotas were exhausted from earlier testing. Daily quotas don't reset until midnight Pacific Time.

I researched every free LLM API available:

| Provider | Model | Free RPD | Free RPM |
|----------|-------|----------|----------|
| Gemini (preview) | Various 3.x | 20 | 5 |
| Gemini (stable) | 2.0 Flash | 1,500 | 15 |
| **Groq** | **Llama 3.3 70B** | **14,400** | **30** |
| Together AI | Llama 3 | ~100 (credits) | — |
| Cloudflare Workers AI | Various | 10,000 neurons | — |

**Groq won by a landslide.** 14,400 RPD, 30 RPM, blazing fast inference on custom LPU hardware, OpenAI-compatible API (just change the base URL). Zero SDK needed — just `fetch()`.

**Lesson:** The best API isn't always the best-known one. Groq's free tier is absurdly generous compared to Google and Anthropic.

---

## 🖼️ Problem 6: Image Generation

**Original plan:** Google Imagen 3 via Gemini API
**Problem:** Rate limited to death along with everything else on the Gemini API

**Replacement:** Pollinations.ai
- Completely free
- No API key needed
- No signup
- Unlimited calls
- Just a URL: `https://image.pollinations.ai/prompt/your+prompt+here`
- Supports the Flux model for high-quality output

**Key discovery:** External image URLs don't embed when you download an SVG. Had to fetch the image and convert to **base64 data URI** so it's baked into the SVG/PNG output.

**Lesson:** Free doesn't mean bad. Pollinations produces surprisingly good results with the right prompt engineering (adding quality tags like "masterpiece, highly detailed, dramatic lighting, artstation").

---

## 📐 Problem 7: SVG Card Layout

This was the most iterative part. The user had a very specific vision for the card (a Polaroid aesthetic) and provided a reference SVG template.

### What I learned about SVG:
- **Coordinate math is everything** — every pixel needs to be manually calculated
- **Fonts must be embedded** for Sharp rendering (base64 in `<defs>`) — or use Google Fonts import for browser rendering
- **External images in SVG break on download** — must convert to base64
- **Client-side PNG export via Canvas** works great and eliminates Sharp dependency on Edge runtime
- **The user's template is law** — stop inventing layouts, follow the reference exactly

### The iteration cycle:
1. First attempt: Dark gradient background, frosted glass → "doesn't match reference"
2. Second attempt: White Polaroid but wrong proportions → "waveform collapsed, date misaligned"
3. Third attempt: Closer but too much wasted space → "font size too small"
4. Fourth attempt: Followed reference SVG coordinates exactly → **"ALMOST!! nice"** ✅
5. Final tweaks: Removed duplicate key phrase, fixed verse alignment → **shipped**

**Lesson:** When a user gives you a reference design, reproduce it pixel-for-pixel first. Get creative later.

---

## ⚡ Problem 8: Sharp on Edge Runtime

Next.js Edge Runtime doesn't support Sharp (native binary). I removed the server-side PNG conversion entirely and switched to **client-side Canvas API**:

```javascript
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
canvas.width = 1080 * 2; // 2x for crisp output
canvas.height = 1350 * 2;
// ... draw SVG → clip to card → export PNG
```

Works everywhere, no dependencies, 2x resolution output. Users get crisp PNGs.

**Lesson:** Don't fight the runtime. If something doesn't work server-side, check if the browser can do it natively.

---

## 🎯 Key Takeaways

1. **Start with cost constraints, not feature lists.** Knowing the budget ($0) forced every good architectural decision.

2. **1 smart API call > 5 simple ones.** Modern LLMs can handle complex multi-output prompts. Don't over-engineer agent systems when a single well-crafted prompt works.

3. **Deterministic > AI for everything that's predictable.** Color palettes, mood suggestions, and card layout don't need AI. Save LLM calls for creative work.

4. **Read the actual rate limit page, not the marketing.** Preview model limits can be 10x worse than stable models.

5. **Free tiers are amazing if you know where to look.** Groq (14,400 RPD), Pollinations (unlimited), Deezer (unlimited) — you can build a real product for $0.

6. **Follow the reference design.** When a user gives you a template, match it exactly before adding your own ideas.

7. **Client-side is underrated.** Canvas PNG export, deterministic computations, seeded shuffles — the browser is powerful.

---

## 🔮 What's Next

- Music waveform visualization on the card
- Aesthetic font designs that match character themes
- AI-aware color palette generation (not just presets)
- Performance optimizations for mobile
- Gallery/collection feature for saving multiple cards

---

*Written during the build process of CardSouls, March 2026.*
*GitHub: [ashwin-r11/CardSouls](https://github.com/ashwin-r11/CardSouls)*
