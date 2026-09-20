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
npm run smoke
```

This runs linting, TypeScript checks, deterministic fixture/hash tests, and a production build. `npm run smoke` also boots a fresh `next start` and verifies Hub routes **and** that every client chunk referenced by Command Center resolves (a stale `next-server` left running across `next build` otherwise 404s chunks and triggers the isolated Hub error boundary).

## Production preview (Cloud / manual QA)

After any `npm run build` or `npm run verify`, restart the preview server so HTML and `/_next/static` stay in sync:

```bash
npm run hub:production
```

Then open `http://127.0.0.1:43123/tools/registry-intelligence-hub`.

## Phase 0 boundaries

- `features.registryIntelligenceHubCatalog` is disabled. No catalog card or production routing is enabled.
- No production server, database, authentication, or external write integration is used.
- Immutable fixture metadata and hashes live in `src/data/fixtures/manifest.json`.
- Rehearsal-round intelligence is calculated in `src/lib/registry-data.ts`.
- Approved **2012 Reveal Day** comparison facts and eligibility gates live in `src/comparison/` (`metric-eligibility-catalog/1.0.0`, `historical-2012-ui-adapter/1.0.0`). Cross-round org identity links use `cross-round-identity/1.0.0` (`npm run normalize -- cross-round-identity`).
- **2026 claim actuality (browser)** — Hub routes load promoted state once per request in `src/app/tools/registry-intelligence-hub/layout.tsx` via `loadPromotedClaimActualityState()` (`src/lib/claim-actuality-server.ts`). Eligibility for Command Center, Explore, Compare, and Briefings resolves through `resolveHubMetricEligibility()` (`src/lib/hub-metric-eligibility.ts`). Production may supply state either as on-disk JSON (default `.data/reveal-2026/claim-actuality-state.json`, override with `REGISTRY_HUB_CLAIM_ACTUALITY_STATE_PATH`) or inline JSON in `REGISTRY_HUB_CLAIM_ACTUALITY_STATE_JSON` (full `claim-actuality-state/1.0.0` document from `npm run reveal-2026 -- promote-actuality`). Env JSON takes precedence over the file. With no promoted state, 2026 remains `NOT_PUBLISHED` and cross-round comparison stays gated.

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

## Offline normalization (2012)

`src/normalization/` is a round-neutral, fixture-only normalization foundation: raw snapshot refs → parsed records → observations → normalized entities, with immutable override replay, deterministic reconciliation states, and content-addressed build artifacts. It does not connect to the browser app or live ICANN HTML scrape.

Design, coverage contract, and quality reporting:

- `/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/docs/domain-model-and-normalization.md`
- `/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/docs/normalization-coverage-contract.md`
- `/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/docs/normalization-quality-report.md` (representative slice)
- `/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/docs/2012-full-round-quality-report.md` (full Reveal Day fixture)

Acquisition notes for the full-round CSV/PDF fixtures: `scripts/acquire-icann2012-reveal-day.md`

```bash
npm run normalize -- list-bundles
npm run normalize -- normalize --bundle icann2012-representative-v1
npm run normalize -- normalize --bundle icann2012-reveal-day-v1
npm run normalize -- report
npm run normalize -- trace application 1-1200-1-1
npm run normalize -- verify --bundle icann2012-reveal-day-v1
npm run normalize -- cross-round-identity
```

- `icann2012-representative-v1` — rehearsal slice (conflicts, overrides, missing refs).
- `icann2012-reveal-day-v1` — **1,930** Reveal Day applications from preserved CSV + official contention PDF extraction (not wired to UI).
- Builds land under `.data/normalization/builds/<buildId>/` (gitignored). `verify` recomputes a fresh offline normalization and checks output hashes plus stored artifact integrity.
