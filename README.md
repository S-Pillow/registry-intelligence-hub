# Registry Intelligence Hub

Registry Intelligence Hub (RIH) is a source-backed research and intelligence application for ICANN gTLD data. It connects historical applications, strings, applicant portfolios, contention, provenance, and future registry-service relationships without collapsing distinct roles such as applicant, Registry Operator, Registry Service Provider, DNS/DNSSEC provider, IANA TLD Manager, or corporate lineage.

## Repository status

- **Main branch:** stable, production-accepted application state plus documentation.
- **Current production application commit:** `774665486d1cd62a9276caf2e76b6af4c66310bb`.
- **Production URL prefix:** `/tools/registry-intelligence-hub`.
- **Production process:** Next.js on loopback port `43123`.
- **2012 historical baseline:** 1,930 applications, 1,409 unique strings, 116 IDN applications.
- **Confirmed 2012 portfolios:** 16 steward-confirmed portfolios covering 466 applications.
- **2026 Reveal Day:** remains gated until an official per-application publication is available and passes the promotion contract.
- **RSP work:** active on separate checkpoint/feature branches. Live acquisition tooling and sanitized fixtures are intentionally not merged into `main` until the evidence and parser remediation cycle is accepted.

The current RSP work is building an auditable path from a 2012 Application ID to the ICANN application record and, later, to Q23-Q25 Registry Service Provider evidence. A mapping or crawler result never becomes an approved fact automatically; source evidence, integrity checks, and steward review remain separate gates.

## Product overview

The runnable browser experience includes a Command Center, Explore research backbone, deterministic metrics, evidence drill-down, historical 2012 browsing, confirmed portfolio views, and responsive loading, empty, and error states.

The fixture is explicitly synthetic rehearsal data. It must not be treated as the official 2026 Reveal Day publication.

## Run locally

Requires Node.js **>=22.0.0** for install, `npm run verify`, and deploy (see `package.json` `engines`). Next.js accepts **>=20.9.0**, but devDependencies on this repo (e.g. Vitest 5, Playwright) emit **EBADENGINE** warnings on Node 20.x — **srv766238** should use **NVM Node 22** for `npm ci`, verify, build, and PM2 (see `deploy/ecosystem.config.cjs.example`).

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

This runs linting, TypeScript checks, deterministic fixture/hash tests, and a production build. On hosts **without** the Cursor Project Store, tests whose only purpose is validating Project Store markdown contracts are **skipped** (not failed). To require those docs, set `REGISTRY_HUB_PROJECT_DOCS_ROOT` to the store `docs/` directory and run `npm run verify:project-docs`.

`npm run smoke` also boots a fresh `next start` and verifies Hub routes **and** that every client chunk referenced by Command Center resolves (a stale `next-server` left running across `next build` otherwise 404s chunks and triggers the isolated Hub error boundary).

## Production preview (Cloud / manual QA)

After any `npm run build` or `npm run verify`, restart the preview server so HTML and `/tools/registry-intelligence-hub/_next/static` stay in sync (`basePath` in `next.config.ts`):

```bash
npm run hub:production
```

Then open `http://127.0.0.1:43123/tools/registry-intelligence-hub`.

## Production rehearsal deploy (ForgeForward / Ubuntu)

Full operator contract (PM2, nginx, ToolsPage catalog, env, smoke): Project store `docs/production-rehearsal-hub-deploy.md` and `docs/rih-basepath-shared-vps-deploy.md` (Registry Intelligence Hub Agent Store).

Minimal rehearsal on a host:

```bash
npm ci
npm run verify
# Rehearsal default — do not export REGISTRY_HUB_* claim/payload pins; remove any stray promotion file:
rm -f .data/reveal-2026/claim-actuality-state.json
npm run smoke
```

Run the Hub behind ForgeForward at `/tools/registry-intelligence-hub` after loopback smoke passes. **Live Tools catalog:** add a card in ForgeForward `ToolsPage.jsx` (hardcoded `tools` array) and rebuild the Vite frontend — not `features.registryIntelligenceHubCatalog` (repo `src/config/features.ts` is Hub-internal only). **srv766238:** PM2 via `deploy/ecosystem.config.cjs.example`, cwd `/root/registry_hub`; `deploy/systemd/…` is for optional alternate hosts. Run `npm run build` then `npm run start -- -H 127.0.0.1 -p 43123` under PM2 — do not use `hub:production` under a process manager. Run **`npm run smoke` before first PM2 start** (or stop PM2 before later smoke — smoke uses port 43123). Staging Path B/C drill (`npm run staging:path-bc-drill`) is optional on staging only — not required for production rehearsal.

## Phase 0 boundaries

- Repo `features.registryIntelligenceHubCatalog` (`src/config/features.ts`) is for Hub-internal/dev defaults only; it does **not** gate the live ForgeForward Tools page.
- No production server, database, authentication, or external write integration is used.
- Immutable fixture metadata and hashes live in `src/data/fixtures/manifest.json`.
- Rehearsal-round intelligence is calculated in `src/lib/registry-data.ts`.
- Approved **2012 Reveal Day** comparison facts and eligibility gates live in `src/comparison/` (`metric-eligibility-catalog/1.0.0`, `historical-2012-ui-adapter/1.0.0`). Cross-round org identity links use `cross-round-identity/1.0.0` (`npm run normalize -- cross-round-identity`).
- **2026 claim actuality (browser)** — Hub routes load promoted state once per request in `src/app/layout.tsx` via `loadPromotedClaimActualityState()` (`src/lib/claim-actuality-server.ts`). Eligibility for Command Center, Explore, Compare, and Briefings resolves through `resolveHubMetricEligibility()` (`src/lib/hub-metric-eligibility.ts`). Production may supply state either as on-disk JSON (default `.data/reveal-2026/claim-actuality-state.json`, override with `REGISTRY_HUB_CLAIM_ACTUALITY_STATE_PATH`) or inline JSON in `REGISTRY_HUB_CLAIM_ACTUALITY_STATE_JSON` (full `claim-actuality-state/1.0.0` document from `npm run reveal-2026 -- promote-actuality`). Env JSON takes precedence over the file. With no promoted state, 2026 remains `NOT_PUBLISHED` and cross-round comparison stays gated.
- **2026 application rows (browser)** — When claim actuality is `REAL_SOURCE_READY` and a configured payload matches `snapshotId` + `snapshotContentHash`, Explore, Compare, Saved, and Briefings use promoted application rows from `registry-browser-applications/1.0.0` (built via `npm run reveal-2026 -- build-browser-payload --snapshot <publication.snapshot.json>`). Configure with `REGISTRY_HUB_APPLICATION_PAYLOAD_PATH` (browser payload JSON or publication snapshot) or `REGISTRY_HUB_APPLICATION_PAYLOAD_JSON` (inline payload document). Env JSON wins over the file. Without a matching promoted payload, the Hub keeps the 12-application rehearsal fixture (`src/data/fixtures/registry-applications.json`). Drill payload fixture: `src/data/fixtures/drill-2026-registry-applications.payload.json`.
- **2012 historical applications (Explore only, D1)** — Separate env: `REGISTRY_HUB_2012_APPLICATION_PAYLOAD_PATH` or `REGISTRY_HUB_2012_APPLICATION_PAYLOAD_JSON`. Artifact: `registry-browser-2012-applications/1.0.0` (`npm run historical-2012 -- build-browser-payload`). Browse at Explore with `?dataset=2012-historical`; default Explore remains 2026 rehearsal/promoted. No fallback to rehearsal when 2012 mode is selected but payload is missing.
- **2012 confirmed organization portfolios (Explore sidecar, D2.4)** — Separate env: `REGISTRY_HUB_2012_CONFIRMED_PORTFOLIOS_PATH` or `REGISTRY_HUB_2012_CONFIRMED_PORTFOLIOS_JSON`. Artifact: `registry-browser-2012-confirmed-portfolios/1.0.0` (`npm run historical-2012 -- build-confirmed-portfolios-sidecar`). Requires the application payload env above; sidecar pins the base corpus hash and fails closed on mismatch. Explore browse: `?dataset=2012-historical&entity=confirmed-portfolios`. Schema: `docs/registry-browser-2012-confirmed-portfolios-sidecar.md`.
- **Staging Path B/C drill** — After offline Path B/C in `docs/reveal-day-operations-drill.md` (Project store), point the Hub at promoted state + browser payload and run `npm run staging:path-bc-drill` (or `STAGING_DRILL_EXPECT_REHEARSAL=1` after teardown). Vitest coverage: `src/reveal-day-2026/staging-path-bc-drill.test.ts`.

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

`src/normalization/` is a round-neutral, fixture-only normalization foundation: raw snapshot refs → parsed records → observations → normalized entities, with immutable override replay, deterministic reconciliation states, and content-addressed build artifacts. CLI build output is not streamed to the browser; three approved 2012 count metrics are pinned separately in `src/comparison/approved-2012-baseline.ts` for Command Center. No live ICANN HTML scrape.

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
- `icann2012-reveal-day-v1` — **1,930** Reveal Day applications from preserved CSV + official contention PDF extraction (offline entities; Command Center exposes three approved count metrics via `historical-2012-ui-adapter/1.0.0`, not full Explore corpus).
- Builds land under `.data/normalization/builds/<buildId>/` (gitignored). `verify` recomputes a fresh offline normalization and checks output hashes plus stored artifact integrity.
