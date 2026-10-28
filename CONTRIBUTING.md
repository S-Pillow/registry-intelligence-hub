# Contributing to Registry Intelligence Hub

RIH is an **evidence-first** intelligence platform for ICANN gTLD rounds. Contributions should strengthen defensible conclusions — not invent claims the evidence cannot support.

## Semantic safety (non-negotiable)

- **Applicant ≠ Organization** — ICANN legal applying entities are not automatically corporate parents or portfolios.
- **MISSING ≠ zero** — unavailable reports or blocked metrics are not treated as zero activity.
- **Public RSP capability ≠ selected RSP** — public Main-RSP signals never imply a contracted provider.
- **Unmatched ≠ new** — lack of a cross-round match is not proof of a new participant.
- **Confirmed subset ≠ complete round** — confirmed Organization intelligence must disclose coverage limits.
- **Candidate mapping ≠ confirmed Organization** — only steward-accepted mappings enter confirmed Organization intelligence.

Factual and product changes need **source / evidence support** (public ICANN/IANA materials, accepted fixtures, steward records, or documented provenance). Prefer omitting or qualifying intelligence over fabricating completeness.

## Development workflow

1. Branch from the current default branch (`main`).
2. Keep changes focused; prefer small reviewable PRs.
3. Do not commit secrets, host-local `.env` files, or runtime `.data/` trees.
4. Open a Pull Request for review before merge.

### Tests and verification

Requires **Node.js >= 22**.

```bash
npm install
npm run verify   # lint + typecheck + tests + production build
npm run smoke    # build + local production route/chunk smoke (uses port 43123 by default)
```

`npm run verify` is the expected local gate for product changes. Some tests require steward/publication fixtures under gitignored `.data/` on operator hosts; they are skipped or fail closed when evidence is absent — do not invent production data to “make tests green.”

## Documentation

Prefer updating the in-repository `docs/` entry points over inventing parallel guides. Historical acceptance closeouts may retain exact host paths and backup locations as **historical evidence** — do not rewrite hashes or accepted run outcomes for cosmetic reasons.

Some operator deploy runbooks live in **internal/operator documentation not included in this repository**. When referencing them, label that limitation clearly rather than fabricating public copies.

## Security issues

Suspected vulnerabilities belong in **private vulnerability reporting**, not normal Issues or PRs. See [`SECURITY.md`](SECURITY.md).

## License and third-party materials

Original RIH source is licensed under Apache-2.0 (`LICENSE`). Third-party public-source data and materials retain their original terms — see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Do not contribute material you lack rights to include.
