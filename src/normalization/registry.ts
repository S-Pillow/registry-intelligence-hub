import type { FixtureBundleDefinition } from "./types";

/**
 * Versioned registry of offline fixture bundles eligible for normalization.
 * Live pipeline handoff is intentionally not wired here — this slice is fixture-only.
 */
export const FIXTURE_BUNDLE_REGISTRY: FixtureBundleDefinition[] = [
  {
    id: "icann2012-representative-v1",
    version: 1,
    label: "ICANN 2012 representative rehearsal slice",
    coverageNote:
      "Hand-authored representative records exercising conflict, missing references, redirects, IDNs, contention, organization candidates, and overrides — NOT the full 2012 application round.",
    roundProgramYear: 2012,
    fixtureRoot: "src/normalization/fixtures/icann2012-representative-v1",
    applicationFormat: "jsonl-dual-source",
    sourceFiles: [
      "raw-snapshots.json",
      "applications.jsonl",
      "contention-sets.json",
      "registry-operators.json",
      "secondary-applications.jsonl",
      "overrides.json",
      "organization-promotions.json",
    ],
  },
  {
    id: "icann2012-reveal-day-v1",
    version: 1,
    label: "ICANN 2012 Reveal Day applications (full round)",
    coverageNote:
      "Full 1,930-application Reveal Day CSV plus official string-similarity contention PDF extraction — offline fixtures only; not wired to UI intelligence.",
    roundProgramYear: 2012,
    fixtureRoot: "src/normalization/fixtures/icann2012-reveal-day-v1",
    applicationFormat: "reveal-day-csv",
    sourceFiles: [
      "raw-snapshots.json",
      "sources/strings-1200utc-13jun12-en.csv",
      "sources/similarity-contention-26feb13-en.pdf",
      "contention-sets.json",
      "registry-operators.json",
      "overrides.json",
      "organization-promotions.json",
    ],
  },
];

export function requireBundle(bundleId: string): FixtureBundleDefinition {
  const bundle = FIXTURE_BUNDLE_REGISTRY.find((b) => b.id === bundleId);
  if (!bundle) {
    throw new Error(`Unknown fixture bundle "${bundleId}". Registered: ${FIXTURE_BUNDLE_REGISTRY.map((b) => b.id).join(", ")}`);
  }
  return bundle;
}
