import type { ReportingPeriod } from "./types";

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, mo: number): number {
  if (mo === 2) return isLeapYear(y) ? 29 : 28;
  return DAYS_IN_MONTH[mo - 1]!;
}

/** Validate calendar YYYY-MM-DD (rejects 2026-02-31 etc.). */
export function assertAsOfDate(asOfDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOfDate.trim());
  if (!m) throw new Error(`Invalid asOfDate ${asOfDate}; expected YYYY-MM-DD`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || mo < 1 || mo > 12) {
    throw new Error(`Invalid asOfDate ${asOfDate}`);
  }
  const dim = daysInMonth(y, mo);
  if (d < 1 || d > dim) {
    throw new Error(`Invalid asOfDate ${asOfDate}; day out of range for month`);
  }
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Withhold: reports public only after three full months after month end.
 * Formula: asOf calendar month − 4 → probe reporting month.
 * Locked: 2026-10-26 → 2026-06.
 */
export function probeReportingPeriodFromAsOf(asOfDate: string): ReportingPeriod {
  const valid = assertAsOfDate(asOfDate);
  const y = Number(valid.slice(0, 4));
  const mo = Number(valid.slice(5, 7));
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
  const period = `${compact.slice(0, 4)}-${compact.slice(4, 6)}`;
  return assertReportingPeriod(period);
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
