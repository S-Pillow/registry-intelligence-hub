import { classifyRegistrarRow } from "./classify";
import { hashNormalizedContent, sha256Hex } from "./hash";
import { parseTransactionsCsv, parseTransactionsFilename } from "./parse";
import { assertReportingPeriod, compactToPeriod, normalizeTldAsciiLabel, periodToCompact } from "./period";
import { computeTldMonthMetrics, emptyTermCounts, sumTermCounts } from "./metrics";
import type {
  AcquisitionOutcome,
  NormalizedRegistrarRow,
  NormalizedTotals,
  NormalizedTransactionsSnapshot,
  ReportingPeriod,
  TermCounts,
} from "./types";
import {
  MRR_PARSER_VERSION,
  MRR_TRANSACTIONS_SCHEMA_VERSION,
} from "./types";

export type NormalizeInput = {
  rawText: string;
  rawBytes: Uint8Array;
  tldAsciiLabel: string;
  reportingPeriod: ReportingPeriod;
  sourceUrl: string;
  resourcePageUrl: string;
  revisionOfRawSha256?: string | null;
};

export type NormalizeSuccess = {
  outcome: "SUCCESS";
  snapshot: NormalizedTransactionsSnapshot;
};

export type NormalizeFailure = {
  outcome: Exclude<AcquisitionOutcome, "SUCCESS" | "MISSING_REPORT" | "DOWNLOAD_FAILED">;
  error: string;
};

function parseNonNegativeInt(raw: string, field: string): number {
  const s = raw.trim();
  if (s === "") throw new Error(`Empty numeric field ${field}`);
  if (!/^-?\d+$/.test(s)) throw new Error(`Invalid numeric field ${field}=${JSON.stringify(raw)}`);
  const n = Number(s);
  if (!Number.isSafeInteger(n)) throw new Error(`Unsafe integer ${field}=${raw}`);
  if (n < 0) throw new Error(`Negative count ${field}=${n}`);
  return n;
}

function readTermCounts(row: Record<string, string>, prefix: "net-adds" | "net-renews"): TermCounts {
  const out = emptyTermCounts();
  for (let y = 1; y <= 10; y++) {
    const key = `${prefix}-${y}-yr` as const;
    out[String(y) as keyof TermCounts] = parseNonNegativeInt(row[key] ?? "", key);
  }
  return out;
}

function rowToTotalsShape(row: Record<string, string>, includeConsolidate: boolean): NormalizedTotals {
  const base: NormalizedTotals = {
    totalDomains: parseNonNegativeInt(row["total-domains"] ?? "", "total-domains"),
    totalNameservers: parseNonNegativeInt(row["total-nameservers"] ?? "", "total-nameservers"),
    netAddsByTerm: readTermCounts(row, "net-adds"),
    netRenewsByTerm: readTermCounts(row, "net-renews"),
    transferGainingSuccessful: parseNonNegativeInt(row["transfer-gaining-successful"] ?? "", "transfer-gaining-successful"),
    transferGainingNacked: parseNonNegativeInt(row["transfer-gaining-nacked"] ?? "", "transfer-gaining-nacked"),
    transferLosingSuccessful: parseNonNegativeInt(row["transfer-losing-successful"] ?? "", "transfer-losing-successful"),
    transferLosingNacked: parseNonNegativeInt(row["transfer-losing-nacked"] ?? "", "transfer-losing-nacked"),
    transferDisputedWon: parseNonNegativeInt(row["transfer-disputed-won"] ?? "", "transfer-disputed-won"),
    transferDisputedLost: parseNonNegativeInt(row["transfer-disputed-lost"] ?? "", "transfer-disputed-lost"),
    transferDisputedNodecision: parseNonNegativeInt(
      row["transfer-disputed-nodecision"] ?? "",
      "transfer-disputed-nodecision",
    ),
    deletedDomainsGrace: parseNonNegativeInt(row["deleted-domains-grace"] ?? "", "deleted-domains-grace"),
    deletedDomainsNograce: parseNonNegativeInt(row["deleted-domains-nograce"] ?? "", "deleted-domains-nograce"),
    restoredDomains: parseNonNegativeInt(row["restored-domains"] ?? "", "restored-domains"),
    restoredNoreport: parseNonNegativeInt(row["restored-noreport"] ?? "", "restored-noreport"),
    agpExemptionRequests: parseNonNegativeInt(row["agp-exemption-requests"] ?? "", "agp-exemption-requests"),
    agpExemptionsGranted: parseNonNegativeInt(row["agp-exemptions-granted"] ?? "", "agp-exemptions-granted"),
    agpExemptedDomains: parseNonNegativeInt(row["agp-exempted-domains"] ?? "", "agp-exempted-domains"),
    attemptedAdds: parseNonNegativeInt(row["attempted-adds"] ?? "", "attempted-adds"),
  };
  if (includeConsolidate) {
    base.consolidateTransactionDays = parseNonNegativeInt(
      row["consolidate-transaction-days"] ?? "",
      "consolidate-transaction-days",
    );
    base.consolidateTransactions = parseNonNegativeInt(
      row["consolidate-transactions"] ?? "",
      "consolidate-transactions",
    );
  }
  return base;
}

function rowToRegistrar(
  row: Record<string, string>,
  includeConsolidate: boolean,
): NormalizedRegistrarRow {
  const registrarName = (row["registrar-name"] ?? "").trim();
  const ianaRegistrarId = (row["iana-id"] ?? "").trim();
  const classification = classifyRegistrarRow(registrarName, ianaRegistrarId);
  const totals = rowToTotalsShape(row, includeConsolidate);
  return {
    ianaRegistrarId,
    registrarName,
    classification,
    totalDomains: totals.totalDomains,
    totalNameservers: totals.totalNameservers,
    netAddsByTerm: totals.netAddsByTerm,
    netRenewsByTerm: totals.netRenewsByTerm,
    transferGainingSuccessful: totals.transferGainingSuccessful,
    transferGainingNacked: totals.transferGainingNacked,
    transferLosingSuccessful: totals.transferLosingSuccessful,
    transferLosingNacked: totals.transferLosingNacked,
    transferDisputedWon: totals.transferDisputedWon,
    transferDisputedLost: totals.transferDisputedLost,
    transferDisputedNodecision: totals.transferDisputedNodecision,
    deletedDomainsGrace: totals.deletedDomainsGrace,
    deletedDomainsNograce: totals.deletedDomainsNograce,
    restoredDomains: totals.restoredDomains,
    restoredNoreport: totals.restoredNoreport,
    agpExemptionRequests: totals.agpExemptionRequests,
    agpExemptionsGranted: totals.agpExemptionsGranted,
    agpExemptedDomains: totals.agpExemptedDomains,
    attemptedAdds: totals.attemptedAdds,
    ...(includeConsolidate
      ? {
          consolidateTransactionDays: totals.consolidateTransactionDays,
          consolidateTransactions: totals.consolidateTransactions,
        }
      : {}),
  };
}

export function normalizeTransactions(input: NormalizeInput): NormalizeSuccess | NormalizeFailure {
  const tld = normalizeTldAsciiLabel(input.tldAsciiLabel);
  const period = assertReportingPeriod(input.reportingPeriod);

  const fromName = parseTransactionsFilename(input.sourceUrl);
  if (fromName) {
    if (fromName.tldAsciiLabel !== tld) {
      return {
        outcome: "VALIDATION_FAILED",
        error: `TLD mismatch: expected ${tld}, filename has ${fromName.tldAsciiLabel}`,
      };
    }
    if (fromName.compactPeriod !== periodToCompact(period)) {
      return {
        outcome: "VALIDATION_FAILED",
        error: `Period mismatch: expected ${periodToCompact(period)}, filename has ${fromName.compactPeriod}`,
      };
    }
  }

  const parsed = parseTransactionsCsv(input.rawText);
  if (!parsed.ok) {
    return { outcome: parsed.failure.outcome, error: parsed.failure.error };
  }

  const includeConsolidate = parsed.table.schemaProfileId === "com-extended-41";
  const warnings: string[] = [];
  let totalsRow: NormalizedTotals | null = null;
  const registrars: NormalizedRegistrarRow[] = [];
  const seenIds = new Set<string>();

  try {
    for (const row of parsed.table.rows) {
      const name = (row["registrar-name"] ?? "").trim();
      if (name.toLowerCase() === "totals") {
        if (totalsRow) {
          return { outcome: "VALIDATION_FAILED", error: "Multiple Totals rows" };
        }
        totalsRow = rowToTotalsShape(row, includeConsolidate);
        continue;
      }
      const reg = rowToRegistrar(row, includeConsolidate);
      if (reg.classification !== "TOTALS") {
        const idKey = reg.ianaRegistrarId;
        if (idKey !== "" && seenIds.has(idKey)) {
          return {
            outcome: "VALIDATION_FAILED",
            error: `Duplicate iana-id ${idKey} within registrar-grain rows`,
          };
        }
        if (idKey !== "") seenIds.add(idKey);
      }
      registrars.push(reg);
    }
  } catch (e) {
    const msg = (e as Error).message;
    return { outcome: "VALIDATION_FAILED", error: msg };
  }

  if (!totalsRow) {
    warnings.push("TOTALS_ROW_ABSENT: summing all non-Totals rows including specials");
    const sumDomains = registrars.reduce((a, r) => a + r.totalDomains, 0);
    totalsRow = {
      totalDomains: sumDomains,
      totalNameservers: registrars.reduce((a, r) => a + r.totalNameservers, 0),
      netAddsByTerm: registrars.reduce((acc, r) => sumTermCounts(acc, r.netAddsByTerm), emptyTermCounts()),
      netRenewsByTerm: registrars.reduce((acc, r) => sumTermCounts(acc, r.netRenewsByTerm), emptyTermCounts()),
      transferGainingSuccessful: registrars.reduce((a, r) => a + r.transferGainingSuccessful, 0),
      transferGainingNacked: registrars.reduce((a, r) => a + r.transferGainingNacked, 0),
      transferLosingSuccessful: registrars.reduce((a, r) => a + r.transferLosingSuccessful, 0),
      transferLosingNacked: registrars.reduce((a, r) => a + r.transferLosingNacked, 0),
      transferDisputedWon: registrars.reduce((a, r) => a + r.transferDisputedWon, 0),
      transferDisputedLost: registrars.reduce((a, r) => a + r.transferDisputedLost, 0),
      transferDisputedNodecision: registrars.reduce((a, r) => a + r.transferDisputedNodecision, 0),
      deletedDomainsGrace: registrars.reduce((a, r) => a + r.deletedDomainsGrace, 0),
      deletedDomainsNograce: registrars.reduce((a, r) => a + r.deletedDomainsNograce, 0),
      restoredDomains: registrars.reduce((a, r) => a + r.restoredDomains, 0),
      restoredNoreport: registrars.reduce((a, r) => a + r.restoredNoreport, 0),
      agpExemptionRequests: registrars.reduce((a, r) => a + r.agpExemptionRequests, 0),
      agpExemptionsGranted: registrars.reduce((a, r) => a + r.agpExemptionsGranted, 0),
      agpExemptedDomains: registrars.reduce((a, r) => a + r.agpExemptedDomains, 0),
      attemptedAdds: registrars.reduce((a, r) => a + r.attemptedAdds, 0),
    };
  } else {
    const sumDomains = registrars.reduce((a, r) => a + r.totalDomains, 0);
    if (sumDomains !== totalsRow.totalDomains) {
      return {
        outcome: "VALIDATION_FAILED",
        error: `Totals reconciliation failed: sum(non-Totals total-domains)=${sumDomains} != Totals=${totalsRow.totalDomains}`,
      };
    }
  }

  const metrics = computeTldMonthMetrics({ totals: totalsRow, registrars });

  const rawSha256 = sha256Hex(input.rawBytes);
  const snapshotWithoutHash: Omit<NormalizedTransactionsSnapshot, "normalizedContentSha256" | "snapshotId"> = {
    schemaVersion: MRR_TRANSACTIONS_SCHEMA_VERSION,
    tldAsciiLabel: tld,
    reportingPeriod: period,
    sourceUrl: input.sourceUrl,
    resourcePageUrl: input.resourcePageUrl,
    rawSha256,
    parserVersion: MRR_PARSER_VERSION,
    schemaProfileVersion: parsed.table.schemaProfileId,
    revisionOfRawSha256: input.revisionOfRawSha256 ?? null,
    totals: totalsRow,
    registrars,
    metrics,
    warnings,
  };

  const normalizedContentSha256 = hashNormalizedContent(snapshotWithoutHash);
  const snapshotId = `mrr-tx-${tld}-${period}-${normalizedContentSha256.slice(0, 16)}`;
  const snapshot: NormalizedTransactionsSnapshot = {
    ...snapshotWithoutHash,
    snapshotId,
    normalizedContentSha256,
  };

  return { outcome: "SUCCESS", snapshot };
}

export function expectedCompactPeriod(period: ReportingPeriod): string {
  return periodToCompact(assertReportingPeriod(period));
}

export function periodFromCompactSafe(compact: string): ReportingPeriod {
  return compactToPeriod(compact);
}
