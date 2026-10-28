# Security Policy

## Supported versions

Security fixes are considered for the **currently maintained RIH line** — the default branch and the currently deployed production application source. Older feature branches and historical checkpoints are not separately supported.

## Reporting a vulnerability

**Do not open a public GitHub Issue, Pull Request, or Discussion for suspected security vulnerabilities.**

Prefer **GitHub Private Vulnerability Reporting** for this repository:

https://github.com/S-Pillow/registry-intelligence-hub/security/advisories/new

If Private Vulnerability Reporting is unavailable for any reason, contact the repository maintainers through a private channel they designate — still do **not** file a public issue that describes an exploit or includes secrets.

### What to include

Helpful reports typically describe:

- affected surface (route, script, dependency, or configuration class)
- steps to reproduce (minimal, deterministic)
- observed vs expected behavior
- RIH version / commit SHA when known
- whether the issue is remote, local, authenticated, or dependency-related

### What not to include

- real credentials, tokens, cookies, private keys, or session material
- full dumps of production `.data`, backups, or host configuration
- sensitive third-party customer or employee information
- proof-of-concept payloads that are broader than needed to demonstrate the issue

## Response

Maintainers will acknowledge and triage reports as capacity allows. This policy does **not** promise a specific response or remediation SLA.

Thank you for helping keep Registry Intelligence Hub and its operators safe.
