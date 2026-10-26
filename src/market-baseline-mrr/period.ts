import type { ReportingPeriod } from "./types";

/** Withhold: reports public only after three full months after month end. */
export function probeReportingPeriodFromAsOf(asOfDate: string): ReportingPeriod {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOfDate.trim());
  if (!m) throw new Error(`Invalid asOfDate ${asOfDate}; expected YYYY-MM-DD`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || mo < 1 || mo > 12 || d < 1 || d > 31) {
    throw new Error(`Invalid asOfDate ${asOfDate}`);
  }
  // Latest eligible calendar month = month of (asOfDate - 3 months), using month arithmetic
  // from the asOf month (not day-precise withhold beyond Spec "three months after end of month").
  // For asOf 2026-10-26 → 2026-07 start of month minus 1 = June 2026 when using end-of-month rule:
  // end of month M is public at start of M+4 calendar month roughly; Spec: withheld until three
  // months after end of reporting month. End of June + 3 months ≈ end of September → public in October.
  // So for asOf in October, June is eligible. Formula: shift asOf month back by 4 months for the
  // reporting month index... Auth locks: asOf 2026-10-26 → probe 2026-06.
  // That is: reportingMonth = asOfMonth - 4.
  let ry = y;
  let rm = mo - 4;
  while (rm <= 0) {
    rm += 12;
    ry -= 1;
  }
  return `${ry}-${String(rm).padStart(2, "0")}`;
}

export function assertReportingPeriod(period: string): ReportingPeriod {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new Error(`Invalid reporting period ${period}; expected YYYY-MM`);
  }
  return period;
}

export function periodToCompact(period: ReportingPeriod): string {
  return period.replace("-", "");
}

export function compactToPeriod(compact: string): ReportingPeriod {
  if (!/^\d{6}$/.test(compact)) throw new Error(`Invalid compact period ${compact}`);
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}`;
}

/** 24 periods ending at probe (probe + previous 23). Newest first. */
export function historyWindowEndingAt(probe: ReportingPeriod, count = 24): ReportingPeriod[] {
  const p = assertReportingPeriod(probe);
  const out: ReportingPeriod[] = [];
  let y = Number(p.slice(0, 4));
  let m = Number(p.slice(5, 7));
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m <= 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export function previousPeriod(period: ReportingPeriod): ReportingPeriod {
  const [ys, ms] = assertReportingPeriod(period).split("-");
  let y = Number(ys);
  let m = Number(ms) - 1;
  if (m <= 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function yearAgoPeriod(period: ReportingPeriod): ReportingPeriod {
  const [ys, ms] = assertReportingPeriod(period).split("-");
  return `${Number(ys) - 1}-${ms}`;
}

export function normalizeTldAsciiLabel(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (s.startsWith(".")) s = s.slice(1);
  if (!s || s.includes(".") || s.includes("/")) {
    throw new Error(`Invalid TLD ascii label ${JSON.stringify(raw)}`);
  }
  return s;
}
