# String Confirmation Day source compatibility (RIH-SCD-SOURCE-COMPATIBILITY-1)

**Status:** implementation readiness (not an acquisition/promotion authorization)  
**Date:** 2026-11-14

## Application CSV — replacement type transition

APS Help states that after String Confirmation Day:

- Unselected string records become status `Deactivated`
- Selected replacement records keep the `-R` Application ID and change Application Type from `Replacement String` to `New gTLD` or `New gTLD with Variants`

Compatibility decision:

- Replacement **row identity** is the documented `-R` Application ID suffix
- Allowed `-R` Application Types: `Replacement String` | `New gTLD` | `New gTLD with Variants`
- Logical Application ID remains the non-`-R` base ID; the `-R` row attaches as `replacementString`
- Chosen/confirmed string is **not** rewritten into `appliedString` solely because an ID ends with `-R`
- Selection evidence remains the published status/type fields on the paired rows

### Unresolved / fail-closed

- Whether ICANN also rewrites the base row `Primary String` after confirmation is not specified here; RIH does not invent that mapping
- `-R` rows with any other Application Type remain rejected
- `Replacement String` without a `-R` ID remains rejected

## Contention CSV — SCD locator

- Reveal Day URL remains the default Change Intelligence contention source
- SCD URL is an explicit `--contention-source string-confirmation` option
- No automatic switch on 17 November
- Unavailable/malformed SCD responses fail closed without substituting Reveal Day data

### Unresolved / fail-closed

- Contention parser continues to reject `-R` membership Application IDs
- If the live SCD CSV uses a different schema or includes `-R` members, treat as unsupported until a governed contract update
