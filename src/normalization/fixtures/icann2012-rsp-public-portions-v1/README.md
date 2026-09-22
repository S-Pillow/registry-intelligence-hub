# ICANN 2012 RSP public application portions (`icann2012-rsp-public-portions-v1`)

Offline workspace contract for **2012 public application portion** HTML (Guidebook **Q23–Q25** extraction targets). Join keys align with committed Reveal Day CSV `Application ID` values; internal fetch ids are **`gtldresultAcId`** integers from `gtldresult.icann.org`.

**Acquisition is not authorized by default.** See `scripts/acquire-icann2012-rsp-portions.md`.

## Directory layout

| Path | Purpose |
| --- | --- |
| `pilot-manifest-25.json` | Steward-review pilot batch (25 Application IDs + selection reasons) |
| `pilot-gtldresult-mapping.json` | **`TEST_ONLY` / `DRAFT`** mapping artifact (`registry-2012-rsp-mapping/1.0.0`) — probe row only |
| `fixtures/synthetic/rsp-mapping-round-wide-exact.fixture.json` | Unmistakable synthetic round-wide template (full 1930 rows generated in tests) |
| `gtldresult-application-index.json` | Full-round index (`applicationId` → URLs) after bounded index pass |
| `raw-snapshots.json` | Per-URL snapshot metadata + SHA-256 (same spirit as reveal-day bundle) |
| `acquisition-checkpoint.json` | Resume / idempotency state |
| `fixtures/synthetic/viewstatus-grid-parser.fixture.html` | **Synthetic** grid HTML for parser/unit tests only (non-evidence) |
| `sources/index/viewstatus-page-{nn}.html` | **Real** immutable grid snapshots for mapping dry-run (`--grid-html`) |
| `sources/portions/{applicationId}/public-portion.html` | Raw ICANN download bytes (staging; not auto-committed) |
| `sources/portions/{applicationId}/public-portion.sha256` | Sidecar checksum |
| `sources/portions/{applicationId}/fetch-metadata.json` | Fetch provenance (`httpStatus`, URL, SHA-256, optional cache headers; **no** cookies/auth) |
| `quarantine/{applicationId}/quarantine.json` | Ambiguous or failed captures |

## Manifest schema (pilot)

- `manifestVersion`: `icann2012-rsp-pilot-manifest/1.0.0`
- `entries[]`: `{ applicationId, selectionReason, validationLeadProviderLabel?, gtldresultAcId? }`
- `validationLeadProviderLabel` is a **QA/reconciliation label only**, not an asserted 2012 RSP fact.

## Mapping file schema (`registry-2012-rsp-mapping/1.0.0`)

- `artifactPurpose`: `TEST_ONLY` | `EVIDENCE` (pilot-live requires `EVIDENCE`)
- `approvalState`: `DRAFT` | `APPROVED` (pilot-live requires `APPROVED`)
- `entries[]`: `{ applicationId, gtldresultAcId, mappingSourceClass, evidenceSnapshotId?, sourceUrl?, evidenceContentSha256?, notes? }`
- Production-eligible rows must reference a committed `raw-snapshots.json` id and non-placeholder evidence hashes.

## Checksum fields

- `raw-snapshots.json` → `provenance.contentSha256` per snapshot
- `public-portion.sha256` → single-line hex digest of `public-portion.html`
- `fetch-metadata.json` → `contentSha256` duplicate for automation

## Join keys

| Key | Source |
| --- | --- |
| `applicationId` | Reveal Day CSV column **Application ID** (e.g. `1-863-45071`) |
| `gtldresultAcId` | Grid/detail/download URLs on `gtldresult.icann.org` — **not** derivable from Application ID numerically |

## Related

- Reveal Day corpus: `../icann2012-reveal-day-v1/`
- Plan: Project store `docs/d2-5a-rsp-public-portions-acquisition-plan.md`
