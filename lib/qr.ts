// lib/qr.ts
// QR code generation — returns SVG string for direct embedding in card SVG
// Uses the 'qrcode' npm package (no browser, no canvas needed)

import QRCode from "qrcode";

export async function generateQRCode(url: string): Promise<string> {
  try {
    // Generate as SVG string — embeds directly into card SVG as a <g> element
    const svg = await QRCode.toString(url, {
      type: "svg",
      width: 100,
      margin: 1,
      color: {
        dark: "#FFFFFF",  // White QR modules (visible on dark card backgrounds)
        light: "#00000000", // Transparent background
      },
      errorCorrectionLevel: "M",
    });

    return svg;
  } catch (err) {
    console.error("[QR] Generation failed:", err);
    // Return minimal placeholder SVG
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="100" height="100" fill="rgba(255,255,255,0.1)" rx="8"/>
      <text x="50" y="55" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="10">QR</text>
    </svg>`;
  }
}
