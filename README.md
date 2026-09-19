# Registry Intelligence Hub

Phase 0 foundation for a source-backed ICANN application intelligence experience. The runnable browser experience includes a frozen v1 Command Center, a composable Explore research backbone, deterministic fixture metrics, evidence drill-down, and responsive loading, empty, and error states.

The fixture is explicitly synthetic rehearsal data. It must not be treated as the official 2026 Reveal Day publication.

## Run locally

Requires Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000/tools/registry-intelligence-hub` for Command Center.
- `http://localhost:3000/tools/registry-intelligence-hub/explore` for Explore.
- `http://localhost:3000/tools/registry-intelligence-hub/compare` for two-to-four like-entity comparison.

State rehearsals are available on either route with `?state=loading`, `?state=empty`, and `?state=error`.

## Verify

```bash
npm run verify
```

This runs linting, TypeScript checks, deterministic fixture/hash tests, and a production build.

## Phase 0 boundaries

- `features.registryIntelligenceHubCatalog` is disabled. No catalog card or production routing is enabled.
- No production server, database, authentication, or external write integration is used.
- Immutable fixture metadata and hashes live in `src/data/fixtures/manifest.json`.
- All displayed numeric intelligence is calculated deterministically in `src/lib/registry-data.ts`.

## Source inventory and snapshot pipeline

`src/pipeline/` is a foundation slice, separate from the browser app above: a typed, versioned registry of authoritative public ICANN/IANA sources (documented in full at `/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/docs/source-inventory.md`, including which sources are approved-for-fetch vs. documented-only) and a local CLI pipeline that fetches, validates, and immutably stores raw source bytes ahead of any future normalization work. It does not feed the browser app's fixtures — that handoff is intentionally left as a stable contract (`listHandoff()` / `npm run pipeline -- handoff`) for a later normalization phase, not wired up yet.

```bash
# Offline by default — fetches from small representative fixtures in src/pipeline/fixtures/,
# never real production payloads. Safe to run with no network access.
npm run pipeline -- list
npm run pipeline -- fetch --all
npm run pipeline -- snapshots
npm run pipeline -- verify
npm run pipeline -- handoff

# Opt-in, bounded, read-only live fetch against the real sources in the registry.
# Always point --root somewhere outside the repo for a live run.
npm run pipeline -- fetch --all --mode live --root /tmp/source-pipeline-live
```

- Every registered source is content-addressed by SHA-256 on write (`.data/source-pipeline/blobs/`, git-ignored) and every fetch attempt — successful or not — is appended to a per-source, never-rewritten manifest (`.data/source-pipeline/manifests/<sourceId>.jsonl`).
- `verify` recomputes hashes for every stored blob and flags tampering or missing files; `snapshots`/`inspect` read manifest history; `handoff` returns the stable, adapter-agnostic contract a future normalizer should read instead of touching manifests or blobs directly.
- No fetched production payload is ever committed to this repository — only the hand-authored fixtures in `src/pipeline/fixtures/` (see that directory's own README) and whatever a `--mode live` run writes to a git-ignored or explicitly out-of-repo `--root`.

## Offline normalization (2012 foundation slice)

`src/normalization/` is a round-neutral, fixture-only normalization foundation: raw snapshot refs → parsed records → observations → normalized entities, with immutable override replay, deterministic reconciliation states, and content-addressed build artifacts. It does not connect to the browser app or live ICANN fetch.

Design and quality reporting:

- `/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/docs/domain-model-and-normalization.md`
- `/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/docs/normalization-quality-report.md`

```bash
npm run normalize -- list-bundles
npm run normalize -- normalize
npm run normalize -- report
npm run normalize -- trace application 1-1200-1-1
npm run normalize -- verify
```

- Default bundle `icann2012-representative-v1` is explicitly **not** the full 2012 round — it exercises conflicts, missing references, redirect provenance, IDNs, contention, organization candidates, and steward overrides.
- Builds land under `.data/normalization/builds/<buildId>/` (gitignored). `verify` recomputes a fresh offline normalization and checks output hashes plus stored artifact integrity.
