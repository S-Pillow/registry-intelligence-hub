#!/usr/bin/env python3
"""
Extract official ICANN string-similarity contention sets (26 Feb 2013 PDF) to JSON.

Input: similarity-contention-26feb13-en.pdf (ICANN newgtlds.icann.org static file).
Output: contention-sets.json for normalization bundle icann2012-reveal-day-v1.

Does not infer contention from identical Reveal Day strings — only PDF membership.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    print("pypdf required: pip install pypdf", file=sys.stderr)
    sys.exit(1)

HYPHENS = "-\u00ad\u2010\u2011\u2012\u2013\u2014\u2212\ufeff"
APP_ID_RE = re.compile(r"(1-\d+-\d+)")


def norm_line(line: str) -> str:
    s = re.sub(f"[{HYPHENS}]+", "-", line)
    s = s.replace("\xa0", " ").replace("\t", " ")
    s = re.sub(r" +", " ", s).strip()
    return s


def parse_pdf_rows(pdf_path: Path) -> list[dict]:
    text = "\n".join(
        (page.extract_text() or "") for page in PdfReader(str(pdf_path)).pages
    )
    lines = [norm_line(l) for l in text.split("\n") if norm_line(l)]

    section: str | None = None
    rows: list[dict] = []

    for line in lines:
        compact = re.sub(r"\s+", " ", line.upper())
        if compact == "NON-EXACT MATCH CONTENTION SETS":
            section = "similarity"
            continue
        if compact == "EXACT MATCH CONTENTION SETS":
            section = "exact"
            continue
        if line.startswith("SET") and "String" in line:
            continue
        if line.startswith("New gTLD") or re.search(r"\d+ of 15", line):
            continue

        m = re.match(r"^(\d+) (\S+) (1-\d+-\d+)", line)
        if m:
            app_id = APP_ID_RE.search(line)
            if app_id:
                if section is None:
                    section = "exact"
                rows.append(
                    {
                        "section": section,
                        "string": m.group(2),
                        "applicationId": app_id.group(1),
                        "sourceSetNumber": m.group(1),
                    }
                )
            continue

        m = re.match(r"^(\S+) (1-\d+-\d+)", line)
        if m:
            app_id = APP_ID_RE.search(line)
            if app_id:
                row_section = section
                if row_section is None:
                    row_section = (
                        "similarity"
                        if m.group(1) in ("hoteis", "hotels", "unicom", "unicorn")
                        else "exact"
                    )
                rows.append(
                    {
                        "section": row_section,
                        "string": m.group(1),
                        "applicationId": app_id.group(1),
                        "sourceSetNumber": None,
                    }
                )

    return rows


def build_sets(rows: list[dict]) -> list[dict]:
    sets: list[dict] = []
    similarity_pending: list[str] = []

    current: dict | None = None

    def flush_current():
        nonlocal current
        if current and current["applicationIds"]:
            sets.append(current)
        current = None

    for row in rows:
        section = row["section"]
        app_id = row["applicationId"]
        string_label = row["string"]
        set_number = row["sourceSetNumber"]

        if section == "similarity":
            flush_current()
            similarity_pending.append(app_id)
            if len(similarity_pending) == 2:
                idx = sum(1 for s in sets if s["matchKind"] == "similarity") + 1
                sets.append(
                    {
                        "setId": f"ICS-2012-similarity-{idx}",
                        "matchKind": "similarity",
                        "applicationIds": similarity_pending.copy(),
                        "sourceSetNumber": str(idx),
                    }
                )
                similarity_pending = []
            continue

        if section == "exact":
            if similarity_pending:
                similarity_pending = []

            if set_number:
                flush_current()
                set_id = f"ICS-2012-exact-{set_number}"
                existing = next((s for s in sets if s["setId"] == set_id), None)
                if existing:
                    existing["applicationIds"].append(app_id)
                    current = None
                else:
                    current = {
                        "setId": set_id,
                        "matchKind": "exact",
                        "applicationIds": [app_id],
                        "sourceSetNumber": set_number,
                    }
                continue

            if current is None:
                current = {
                    "setId": f"ICS-2012-exact-pair-{len(sets) + 1}",
                    "matchKind": "exact",
                    "applicationIds": [app_id],
                    "sourceSetNumber": None,
                    "_string": string_label,
                }
                continue

            if current.get("_string") == string_label:
                current["applicationIds"].append(app_id)
            else:
                flush_current()
                current = {
                    "setId": f"ICS-2012-exact-pair-{len(sets) + 1}",
                    "matchKind": "exact",
                    "applicationIds": [app_id],
                    "sourceSetNumber": None,
                    "_string": string_label,
                }

    flush_current()

    for s in sets:
        s.pop("_string", None)
    return sets


def main() -> None:
    pdf = Path(sys.argv[1] if len(sys.argv) > 1 else "")
    out = Path(sys.argv[2] if len(sys.argv) > 2 else "")
    if not pdf.is_file():
        print("usage: extract-2012-contention-sets.py <pdf> <out.json>", file=sys.stderr)
        sys.exit(1)

    rows = parse_pdf_rows(pdf)
    sets = build_sets(rows)
    app_ids = {aid for s in sets for aid in s["applicationIds"]}
    payload = {
        "extractorVersion": "icann2012-contention-pdf/1.0.0",
        "sourcePublication": "similarity-contention-26feb13-en.pdf",
        "effectiveAt": "2013-02-26T00:00:00.000Z",
        "setCount": len(sets),
        "applicationMembershipCount": sum(len(s["applicationIds"]) for s in sets),
        "uniqueApplicationIds": len(app_ids),
        "sets": sets,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"wrote {out}: {payload['setCount']} sets, "
        f"{payload['applicationMembershipCount']} memberships, "
        f"{payload['uniqueApplicationIds']} unique application ids",
    )


if __name__ == "__main__":
    main()
