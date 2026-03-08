// lib/image-gen.ts
// Image generation via Pollinations.ai — free, no key needed
// Uses POST API for reliability (no URL length limits)

export async function generateImage(
  prompt: string,
): Promise<string | undefined> {
  try {
    // Trim prompt and add style suffix
    const enhanced = `${prompt.slice(0, 500)}, illustrated style, collectible card art, masterpiece`;

    console.log("[ImageGen] Requesting image from Pollinations (POST)...");
    console.log("[ImageGen] Prompt:", enhanced.slice(0, 100) + "...");
    const start = Date.now();

    // POST API is more reliable than GET — no URL length limits
    const res = await fetch("https://image.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: enhanced,
        width: 768,
        height: 1024,
        seed: Math.floor(Math.random() * 999999),
        nologo: true,
        model: "flux",
      }),
      signal: AbortSignal.timeout(55000), // 55s timeout (route is 60s)
    });

    const elapsed = Math.round((Date.now() - start) / 1000);

    if (!res.ok) {
      console.warn(`[ImageGen] HTTP ${res.status} after ${elapsed}s`);
      // Fallback: try GET method
      return await generateImageGET(enhanced);
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    if (buf.length < 2000) {
      console.warn(
        `[ImageGen] POST response too small (${buf.length}B) — trying GET fallback`,
      );
      return await generateImageGET(enhanced);
    }

    const mime = res.headers.get("content-type") || "image/jpeg";
    const b64 = buf.toString("base64");

    console.log(
      `[ImageGen] ✓ Got ${Math.round(buf.length / 1024)}KB image in ${elapsed}s (POST)`,
    );
    return `data:${mime};base64,${b64}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ImageGen] POST failed: ${msg} — trying GET fallback`);
    // Fallback: try GET method
    return await generateImageGET(prompt.slice(0, 300));
  }
}

// GET fallback — simpler prompt, shorter URL
async function generateImageGET(
  prompt: string,
): Promise<string | undefined> {
  try {
    const encoded = encodeURIComponent(prompt.slice(0, 300));
    const seed = Math.floor(Math.random() * 999999);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=1024&seed=${seed}&nologo=true&model=flux`;

    console.log("[ImageGen] Trying GET fallback...");
    const start = Date.now();

    const res = await fetch(url, {
      signal: AbortSignal.timeout(50000),
    });

    const elapsed = Math.round((Date.now() - start) / 1000);

    if (!res.ok) {
      console.warn(`[ImageGen] GET fallback HTTP ${res.status} after ${elapsed}s`);
      return undefined;
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    if (buf.length < 2000) {
      console.warn(`[ImageGen] GET response too small (${buf.length}B)`);
      return undefined;
    }

    const mime = res.headers.get("content-type") || "image/jpeg";
    const b64 = buf.toString("base64");

    console.log(
      `[ImageGen] ✓ Got ${Math.round(buf.length / 1024)}KB image in ${elapsed}s (GET)`,
    );
    return `data:${mime};base64,${b64}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ImageGen] GET fallback also failed: ${msg}`);
    return undefined;
  }
}
