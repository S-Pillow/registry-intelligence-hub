# Pipeline fixtures

Every file in this directory is **hand-authored and synthetic** — none of it was fetched from a live network call. That's a hard rule for this pipeline (see `docs/source-inventory.md`'s "commit no fetched production payloads" boundary): the only bytes ever fetched from real ICANN/IANA sources are the ones a `--mode live` run writes to a runtime `.data/source-pipeline/` (or an explicit `--root` elsewhere), which is git-ignored and never committed.

These fixtures exist so:

- `npm run pipeline -- fetch --all` works completely offline, deterministically, in any fresh clone or CI run (the default `--mode fixture`).
- Unit/integration tests exercise the full pipeline (validation, content-addressed storage, manifests) without a network dependency.

Each fixture is a small, clearly-labeled stand-in shaped like the real source it represents — same format, same rough structure — but with placeholder content, not a copy of anything ICANN or IANA actually publish.
