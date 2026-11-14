import { HUB_BASE_PATH, withBasePath } from "@/lib/hub-paths";

/** Public production origin for absolute Open Graph / Twitter URLs. */
export const HUB_PUBLIC_ORIGIN = "https://forgeforward.app";

/** Canonical hub homepage (includes basePath). */
export const HUB_CANONICAL_URL = `${HUB_PUBLIC_ORIGIN}${HUB_BASE_PATH}`;

/**
 * Public-folder relative path for the social preview PNG.
 * Served under Next.js `basePath` as `/tools/registry-intelligence-hub/social/rih-og-preview.png`.
 */
export const HUB_OG_IMAGE_PATH = "/social/rih-og-preview.png";

export const HUB_OG_IMAGE_WIDTH = 1200;
export const HUB_OG_IMAGE_HEIGHT = 630;

/** Absolute public URL for the OG image (must resolve without auth). */
export const HUB_OG_IMAGE_URL = `${HUB_PUBLIC_ORIGIN}${withBasePath(HUB_OG_IMAGE_PATH)}`;

export const HUB_OG_TITLE = "Registry Intelligence Hub";

export const HUB_OG_DESCRIPTION =
  "Explore ICANN gTLD applications, competitive landscape, contention, registry market data, and historical comparisons in one independent research dashboard.";

export const HUB_OG_IMAGE_ALT =
  "Registry Intelligence Hub — evidence-backed intelligence for ICANN gTLD rounds";

export const HUB_OG_SITE_NAME = "Registry Intelligence Hub";
