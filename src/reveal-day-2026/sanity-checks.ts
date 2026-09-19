import type { DryRunDiagnostics, Registry2026PublicationSnapshot, ValidationIssue } from "./types";
import { validatePublicationSnapshot, validationFailed } from "./validate";

export type SanityCheckReport = {
  ok: boolean;
  counts: DryRunDiagnostics["recordCounts"];
  duplicateApplicationIds: string[];
  missingApplicationIds: number;
  idnRowsMissingALabel: number;
  idnRowsWithInvalidALabel: number;
  expectedApplicationCount: number | null;
  expectedCountGate: "not-set" | "pass" | "fail";
  issues: ValidationIssue[];
};

export function runSanityChecks(
  snapshot: Registry2026PublicationSnapshot,
  diagnostics: DryRunDiagnostics,
  expectedApplicationCount?: number,
): SanityCheckReport {
  const { issues } = validatePublicationSnapshot(snapshot, {
    enforceProductionRowBounds: snapshot.publicationKind === "immutable-publication",
  });
  const duplicateApplicationIds = issues
    .filter((i) => i.code === "duplicate-application-id")
    .map((i) => i.message);

  const missingApplicationIds = snapshot.applications.filter((row) => !/^APP-\d+$/.test(row.id)).length;

  let idnRowsMissingALabel = 0;
  let idnRowsWithInvalidALabel = 0;
  for (const row of snapshot.applications) {
    if (!row.idn) continue;
    if (!row.aLabel) idnRowsMissingALabel++;
    else if (!row.aLabel.startsWith("xn--") || row.aLabel.length < 5) idnRowsWithInvalidALabel++;
  }

  let expectedCountGate: SanityCheckReport["expectedCountGate"] = "not-set";
  const gateIssues: ValidationIssue[] = [];
  if (expectedApplicationCount !== undefined) {
    if (diagnostics.recordCounts.applications === expectedApplicationCount) {
      expectedCountGate = "pass";
    } else {
      expectedCountGate = "fail";
      gateIssues.push({
        code: "expected-count-mismatch",
        severity: "error",
        message: `Expected application count ${expectedApplicationCount}, got ${diagnostics.recordCounts.applications}`,
      });
    }
  }

  const allIssues = [...issues, ...gateIssues];
  const ok = !validationFailed(allIssues) && expectedCountGate !== "fail";

  return {
    ok,
    counts: diagnostics.recordCounts,
    duplicateApplicationIds,
    missingApplicationIds,
    idnRowsMissingALabel,
    idnRowsWithInvalidALabel,
    expectedApplicationCount: expectedApplicationCount ?? null,
    expectedCountGate,
    issues: allIssues,
  };
}
