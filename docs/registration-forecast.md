# Registration forecast (RIH-FCAST-01)

Experimental estimates of how many domains an eligible 2026 extension might hold approximately four years after launch.

## Method (inspiration, not a copy)

Publicly described Toyroom approach: measure **suffix demand** (how many existing domains’ second-level labels equal/end with the applied-for word), then apply a transparent conversion band for word-like / compound strings:

| Scenario | Factor |
| --- | --- |
| Conservative | 0.8 |
| Expected | 1.9 |
| Optimistic | 3.2 |

Toyroom’s proprietary predictions are **not** displayed as RIH facts.

## Hard rules

- One forecast per unique **selected/current** string
- Exclude confirmed closed-brand strings (all Applications Brand-designated)
- Preserve contention status; **do not** predict auction/CPE winners
- Label outputs as **estimates, not facts**
- **Never** treat ICANN MRR TLD totals as suffix-demand counts

## Current coverage (v1)

Route: `/forecast`

Application identity comes from the active browser publication. Domain-name-level suffix-demand evidence is **not** currently accessible in this environment (no approved CZDS/zone-file panel or licensed domain index). The UI therefore shows representative strings with an explicit **demand unavailable** state rather than fabricated numbers.

### Simplest alternative input

Authorize a bounded, redistributable domain-name sample or approved zone-file panel for a fixed set of existing open gTLDs; compute suffix-demand counts against that panel; then emit numeric ranges with the experimental conversions.

## Validation posture

Focused unit tests for conversions, eligibility, brand exclusion, and no-fabrication when demand is missing. No extensive 2012 backtesting in v1.
