// lib/image-gen.ts
// Image generation via Pollinations.ai — free, no key needed
// Fetches image and converts to base64 data URI for SVG embedding

export async function generateImage(
  prompt: string,
): Promise<string | undefined> {
  try {
    const enhanced = `${prompt}, digital painting, highly detailed, cinematic lighting, dramatic, masterpiece, best quality, artstation`;
    const encoded = encodeURIComponent(enhanced);
    const seed = Math.floor(Math.random() * 999999);

    // Use flux model, 1024x1024, no watermark
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

    console.log("[ImageGen] Requesting image from Pollinations...");
    const start = Date.now();

    const res = await fetch(url, {
      signal: AbortSignal.timeout(60000), // 60s — Pollinations can be slow
    });

    const elapsed = Math.round((Date.now() - start) / 1000);

    if (!res.ok) {
      console.warn(`[ImageGen] HTTP ${res.status} after ${elapsed}s`);
      return undefined;
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    if (buf.length < 2000) {
      console.warn(
        `[ImageGen] Response too small (${buf.length}B) — likely error page`,
      );
      return undefined;
    }

    const mime = res.headers.get("content-type") || "image/jpeg";
    const b64 = buf.toString("base64");

    console.log(
      `[ImageGen] ✓ Got ${Math.round(buf.length / 1024)}KB image in ${elapsed}s`,
    );
    return `data:${mime};base64,${b64}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ImageGen] Failed: ${msg}`);
    return undefined;
  }
}
