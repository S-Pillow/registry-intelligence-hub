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
