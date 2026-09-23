# Sanitized live mapping checkpoints (offline remediation / TEST_ONLY)

Immutable HTML captured during the first authorized P0.3C mapping-live run (`mapping-20260922-vps-01`).

- **Canonical v3 transfer:** `transfer/d2-5a-p0-3i3c-sanitized-fixture-v3` @ `354878d64d8faf98a3cb332680e38ca68f16199a`
- **Do not edit** sanitized HTML to make the parser pass — fix parser/pagination/safety code instead.
- **Authority:** `sanitized-live-fixture-manifest.json` (`manifest/3.0.0` field names; pins in `sanitized-live-fixture-constants.ts`)
- **Fail closed:** `REGISTRY_HUB_RSP_REQUIRE_SANITIZED_FIXTURE=1` requires the v3 manifest + both HTML pages on disk
- **Not** APPROVED mapping evidence or pilot-live eligible.

Expected layout (published bundle — fetch-metadata JSON paths in manifest are provenance refs only):

```
mapping-20260922-vps-01/
  sanitized-live-fixture-manifest.json
  page-0001.html   # sanitizedHtmlSha256 pin (35-row grid)
  page-0002.html   # ICANN Application Result error page
```

Manifest distinguishes **file-body SHA**, **manifestSha256 self-digest**, and per-page **sourceHtmlSha256** (provenance) vs **sanitizedHtmlSha256** (bytes on disk). Page 0002 may have identical source/sanitized hashes.
