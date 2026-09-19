import { fileURLToPath } from "node:url";
import type { FixtureEntry } from "./adapters/fixture-adapter";

const fixturesDir = fileURLToPath(new URL("./fixtures/", import.meta.url));

/**
 * Maps every SOURCE_REGISTRY id to its representative fixture on disk. This
 * is what `--mode fixture` (the default) fetches against — see
 * fixtures/README.md for why none of this is real fetched data.
 */
export const DEFAULT_FIXTURES: Record<string, FixtureEntry> = {
  "icann-2012-reveal-day-overview-pdf": {
    filePath: `${fixturesDir}icann-2012-reveal-day-overview.fixture.pdf`,
    mediaType: "application/pdf",
  },
  "iana-root-zone-tld-list-text": {
    filePath: `${fixturesDir}iana-root-zone-tld-list-text.fixture.txt`,
    mediaType: "text/plain",
  },
  "iana-root-zone-tld-list-json": {
    filePath: `${fixturesDir}iana-root-zone-tld-list-json.fixture.json`,
    mediaType: "application/json",
  },
  "iana-root-zone-tld-schema-json": {
    filePath: `${fixturesDir}iana-root-zone-tld-schema-json.fixture.json`,
    mediaType: "application/json",
  },
  "icann-2026-reveal-day-drill-ndjson": {
    filePath: `${fixturesDir}icann-2026-reveal-day-drill.ndjson`,
    mediaType: "application/x-ndjson",
  },
};
