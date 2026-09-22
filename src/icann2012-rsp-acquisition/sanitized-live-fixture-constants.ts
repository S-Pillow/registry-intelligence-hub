/** SHA-256 of committed sanitized `page-0001.html` bytes (35-row grid regression). */
export const SANITIZED_LIVE_PAGE_0001_CONTENT_SHA256 =
  "56fca2d9a7e870a5be4f5e0367f523cb066048464c88865c9a7130f1fd5ecc8a";

/** SHA-256 of committed sanitized `page-0002.html` bytes (ICANN Error regression). */
export const SANITIZED_LIVE_PAGE_0002_CONTENT_SHA256 =
  "918be5343f7b7f8f6a44df28cf176f7c06ff9a3396f3a26650c866e248855485";

/** Declared pin on `sanitized-live-fixture-manifest.json` (P0.3D authority — not page content). */
export const SANITIZED_LIVE_FIXTURE_MANIFEST_DECLARED_SHA256 =
  "80df0195b283c5265ff8004720bfbbdf15822dd30134545ae2f5ba6c869f863e";

/** SHA-256 of RESTRICTED_RAW_SOURCE bytes captured before sanitization (page 0001 provenance only). */
export const RESTRICTED_RAW_PAGE_0001_SOURCE_SHA256 =
  "22669af9ef0b084a0ab790d0a9df84065e5d1b4f74cdba540d87b41f09081ccf";

export const REGISTRY_HUB_RSP_REQUIRE_SANITIZED_FIXTURE_ENV =
  "REGISTRY_HUB_RSP_REQUIRE_SANITIZED_FIXTURE" as const;
