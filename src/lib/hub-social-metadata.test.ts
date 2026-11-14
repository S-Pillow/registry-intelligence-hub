import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HUB_CANONICAL_URL,
  HUB_OG_DESCRIPTION,
  HUB_OG_IMAGE_ALT,
  HUB_OG_IMAGE_HEIGHT,
  HUB_OG_IMAGE_PATH,
  HUB_OG_IMAGE_URL,
  HUB_OG_IMAGE_WIDTH,
  HUB_OG_SITE_NAME,
  HUB_OG_TITLE,
} from "@/lib/hub-social-metadata";
import { HUB_BASE_PATH, withBasePath } from "@/lib/hub-paths";

function pngDimensions(buf: Buffer): { width: number; height: number } {
  // PNG signature (8) + IHDR length (4) + type (4) → width/height at 16/20
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("not a PNG");
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

describe("hub social preview metadata", () => {
  it("keeps absolute OG image URL under the hub basePath", () => {
    expect(HUB_BASE_PATH).toBe("/tools/registry-intelligence-hub");
    expect(HUB_OG_IMAGE_PATH).toBe("/social/rih-og-preview.png");
    expect(withBasePath(HUB_OG_IMAGE_PATH)).toBe(
      "/tools/registry-intelligence-hub/social/rih-og-preview.png",
    );
    expect(HUB_OG_IMAGE_URL).toBe(
      "https://forgeforward.app/tools/registry-intelligence-hub/social/rih-og-preview.png",
    );
    expect(HUB_CANONICAL_URL).toBe(
      "https://forgeforward.app/tools/registry-intelligence-hub",
    );
  });

  it("uses the approved LinkedIn / Open Graph copy", () => {
    expect(HUB_OG_TITLE).toBe("Registry Intelligence Hub");
    expect(HUB_OG_SITE_NAME).toBe("Registry Intelligence Hub");
    expect(HUB_OG_DESCRIPTION).toBe(
      "Explore ICANN gTLD applications, competitive landscape, contention, registry market data, and historical comparisons in one independent research dashboard.",
    );
    expect(HUB_OG_IMAGE_ALT).toContain("Registry Intelligence Hub");
    expect(HUB_OG_IMAGE_WIDTH).toBe(1200);
    expect(HUB_OG_IMAGE_HEIGHT).toBe(630);
  });

  it("ships a 1200×630 PNG social asset in public/", () => {
    const pngPath = join(process.cwd(), "public/social/rih-og-preview.png");
    const buf = readFileSync(pngPath);
    expect(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      true,
    );
    const { width, height } = pngDimensions(buf);
    expect(width).toBe(1200);
    expect(height).toBe(630);
  });
});
