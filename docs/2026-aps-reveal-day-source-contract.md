# 2026 APS Reveal Day source contract

**Status:** inspection contract only. No APS adapter. No live capture. No promotion.

ICANN’s 22 September 2026 announcement is the authority for the confirmed facts below. Public material available for this record does not establish a machine-facing APS contract. Unknowns stay unknown. This checklist is evidence collection. It is not permission to scrape, crawl, or call ICANN.

`npm run reveal-2026 -- build-publication` still accepts only a local file whose media type has a registered `CapturedArtifactParser`. Today that registry contains `application/x-ndjson` (`registry-2026-intake-wire/1.0.0`). That wire is the offline builder’s current input. It is not a finding that APS publishes NDJSON.

## Confirmed

- The public publication system is named Application Publication and Statistics (APS).
- APS is the Reveal Day public publication surface.
- APS is separate from TAMS.
- APS draws public-facing data from TAMS.
- APS provides high-level program statistics.
- 1,616 paid 2026 applications will proceed to publication of their public-facing portions. That figure is the announced program count. It is not an observed artifact row count.
- Reveal Day publication includes applied-for strings.
- Reveal Day publication includes variant strings and replacement strings where applicable.
- Reveal Day publication includes public portions of applications.
- Reveal Day publication includes contention sets for identical applied-for strings.
- APS/TAMS testing is ongoing. No completion date is part of this record.

## Not yet confirmed

- APS public URL
- Downloadable artifact URL
- Media type
- Whether any download is CSV, JSON, or NDJSON
- Public API availability
- Pagination
- Authentication
- Rate limits
- Export controls
- Field names
- Stable application identifiers
- Character encoding
- Timestamps or version markers on the publication
- HTTP cache or ETag behavior
- Bulk-download behavior

Do not fill any of these from the 2012 Reveal Day CSV, the rehearsal fixture, or the synthetic NDJSON wire.

## Reveal Day inspection checklist

Complete this list from the live APS surface before implementing an adapter and before `promote-actuality`. Record what was observed. Leave an item blank when it was not observed.

1. APS canonical URL.
2. Redirect chain.
3. HTTP status.
4. Response headers that identify the resource, its version, or its cache policy.
5. Content type.
6. Downloadable or export links.
7. Whether the rows are present in the server-rendered document or loaded by a later XHR or fetch.
8. Any public API requests the page makes.
9. Pagination or infinite-scroll behavior.
10. Application identifier format.
11. Applied-for string field, including exact spelling and whether the value is a U-label.
12. Applicant and public organization fields, and whether they are legal names or display labels.
13. IDN, A-label, and U-label representation.
14. Variant-string representation.
15. Replacement-string representation.
16. Application-type or designation fields, with the public definition of each value.
17. Contention-set representation for identical applied-for strings.
18. Total row or application count in the artifact.
19. Whether APS statistics agree with the artifact’s row count.
20. Whether one application has a stable detail URL.
21. Whether public application portions are separately downloadable.
22. Timestamps, version, or revision indicators.
23. Robots, terms, and public-access constraints that apply to automated capture.
24. The exact raw artifact or artifacts required to reproduce the publication bytes.

`build-publication` does not perform this inspection. It does not follow redirects. A bundle built today stores `lineage.redirectChain` as `[]` and `lineage.responseHeaderDigest` as `null`. Those slots are for a later capture that actually observed them. They are not inferred here.

## Adapter decision

No case is selected. Select one only after the checklist is filled from APS itself.

| Case | Observed mechanic | Decision |
| --- | --- | --- |
| A | NDJSON compatible with `registry-2026-intake-wire/1.0.0` | Use the existing `CapturedArtifactParser` after the wire contract is verified against the captured bytes. Compatibility is not assumed from the media type alone. |
| B | Structured CSV or JSON that is not that wire | Implement one new `CapturedArtifactParser`. Keep `registry-2026-publication/1.1.0` unchanged if the existing application fields can carry the rows. |
| C | Public API | Separate capture from normalization. Store raw API responses as immutable local artifacts first. `build-publication` still reads those local artifacts. It does not call the API. |
| D | HTML or client-rendered page only | Do not build a scraper as the first step. Record the request and data-loading mechanism, then identify the most stable official public artifact. |
| E | More than one official artifact | Name which artifact is canonical for application rows and which artifacts are supplemental statistics or other evidence. Do not merge them without an explicit source reconciliation. |

## Semantic guards

Three contention concepts stay distinct until a later reconciliation says otherwise:

- RIH exact `Application.string` grouping (`exact-applied-string-grouping/1.0.0`).
- Official APS identical-string contention-set membership, if APS publishes it.
- Contention produced later by other program processes.

Do not replace exact-string grouping with APS contention data automatically. The 2012 extracted-versus-cited contention-set count (234 versus 232) stays a separate issue.

APS may not expose every field that was submitted. If it exposes Community, Geographic Name, Brand, IDN, variants, or replacement strings, record the exact public field semantics before mapping them. Do not copy 2012 field meanings onto 2026 labels because the words look similar.

Organization labels, portfolios, RSP relationships, and category or geography comparisons stay on their existing gates. This contract does not resolve them. Application publication still does not imply organization intelligence. `build-publication` does not promote, and a completed checklist does not promote.
