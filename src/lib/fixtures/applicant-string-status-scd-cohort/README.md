# Applicant string-status SCD cohort fixture

Portable Vitest fixture derived from the approved isolated SCD publication candidate.

- Application snapshot: `snap-aps-2026-applications-string-confirmation-v1`
- Application graph: `1d8ba53c6042e9ed13cf012b15ac1ec6b74eb2f272a548cf8c217fed8d2f80ad`
- Contention snapshot: `snap-aps-2026-contention-string-confirmation-v1`
- Contention semantic pin: `43e279185468f9335119720ece167043119e88718a8afcb2c845ea8ed6f6c6d1`

Inclusion: Registry Services, LLC + ShortDot (Ireland) Limited applications, plus all peers in their SCD contention sets.

This is a real extracted cohort, not synthetic invented counts. See `PROVENANCE.json`.

## Regenerating

From a checkout that has the approved candidate directory:

```bash
export RIH_SCD_CANDIDATE_DIR=/path/to/rih-scd-pub-candidate-20261119-stats
# Rebuild browser cohort via the extraction used in RIH-SCD-APPLICANT-STATUS-1A
# (must preserve provenance.expectedAcceptance and SCD identity pins).
```

Default `npm run test` must not require `/tmp` or any VPS-local path.
