/** SHA-256 of committed sanitized `page-0001.html` bytes (35-row grid regression). */
export const SANITIZED_LIVE_PAGE_0001_SANITIZED_SHA256 =
  "c49a1d1c28c1396d78e8ce23a631a809e8bb4a01588e97aadf4ad581b0d9d95f";

/** SHA-256 of committed sanitized `page-0002.html` bytes (ICANN error regression). */
export const SANITIZED_LIVE_PAGE_0002_SANITIZED_SHA256 =
  "918be5343f7b7f8f6a44df28cf176f7c06ff9a3396f3a26650c866e248855485";

/** @deprecated Use SANITIZED_LIVE_PAGE_0001_SANITIZED_SHA256 */
export const SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256 = SANITIZED_LIVE_PAGE_0001_SANITIZED_SHA256;

/** @deprecated Use SANITIZED_LIVE_PAGE_0002_SANITIZED_SHA256 */
export const SANITIZED_LIVE_PAGE_0002_CONTENT_SHA256 = SANITIZED_LIVE_PAGE_0002_SANITIZED_SHA256;

/** RESTRICTED_RAW_SOURCE provenance pin for page 0001 (never compared to sanitized bytes). */
export const SANITIZED_LIVE_PAGE_0001_SOURCE_SHA256 =
  "22669af9ef0b084a0ab790d0a9df84065e5d1b4f74cdba540d87b41f09081ccf";

/** @deprecated Use SANITIZED_LIVE_PAGE_0001_SOURCE_SHA256 */
export const RESTRICTED_RAW_PAGE_0001_SOURCE_SHA256 = SANITIZED_LIVE_PAGE_0001_SOURCE_SHA256;

/** Page 0002 source/sanitized equality is allowed (no sensitive delta). */
export const SANITIZED_LIVE_PAGE_0002_SOURCE_SHA256 =
  "918be5343f7b7f8f6a44df28cf176f7c06ff9a3396f3a26650c866e248855485";

/** Manifest self-digest (JSON without manifestSha256, indent=2, trailing newline). */
export const SANITIZED_LIVE_FIXTURE_MANIFEST_SELF_DIGEST_SHA256 =
  "fec92aceb00f12c9151179040415f44ea6750bf77711d6e4980ad8edbef6b68a";

/** SHA-256 of on-disk `sanitized-live-fixture-manifest.json` file bytes. */
export const SANITIZED_LIVE_FIXTURE_MANIFEST_FILE_BODY_SHA256 =
  "8c964d2ca13952bf22bfc64da71fbe4fef1a3b0ded66a2aab65ef32b37bc4453";

export const REGISTRY_HUB_RSP_REQUIRE_SANITIZED_FIXTURE_ENV =
  "REGISTRY_HUB_RSP_REQUIRE_SANITIZED_FIXTURE" as const;
