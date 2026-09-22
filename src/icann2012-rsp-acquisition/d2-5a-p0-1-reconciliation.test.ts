import { describe, expect, it } from "vitest";
import { isMappingLiveAuthorized, isPilotLiveAuthorized } from "./auth-gates";
import { networkPolicyForCommand } from "./command-mode";
import { buildPortionFetchMetadata, redactForbiddenFetchMetadataKeys } from "./fetch-metadata-contract";
import { EVIDENCE_SOURCE_CLASSIFICATIONS } from "./evidence-source-classification";
import { defaultRspRelationshipTemporal, RSP_RELATIONSHIP_SCHEMA_VERSION } from "./rsp-relationship-schema";
import { buildPreflightReport, formatPreflightReport } from "./preflight-report";
import { join } from "node:path";

const workspaceRoot = join(process.cwd());

describe("D2.5A-P0.1R reconciliation contracts", () => {
  it("preserves draft rsp-relationship temporal defaults", () => {
    expect(RSP_RELATIONSHIP_SCHEMA_VERSION).toBe("rsp-relationship/1.0.0");
    expect(defaultRspRelationshipTemporal()).toEqual({
      livePortion: "current_public_portion",
      changeHistoryStatus: "not_checked",
    });
  });

  it("preserves evidence source classification vocabulary", () => {
    expect(EVIDENCE_SOURCE_CLASSIFICATIONS).toContain("THIRD_PARTY_VALIDATION_LEAD");
    expect(EVIDENCE_SOURCE_CLASSIFICATIONS).toContain("PUBLIC_ICANN");
  });

  it("redacts forbidden HTTP metadata keys", () => {
    const redacted = redactForbiddenFetchMetadataKeys({
      "Content-Type": "text/html",
      Cookie: "secret",
      authorization: "Bearer x",
    });
    expect(redacted["Content-Type"]).toBe("text/html");
    expect(redacted.Cookie).toBeUndefined();
    expect(redacted.authorization).toBeUndefined();
  });

  it("records extended fetch metadata fields", () => {
    const record = buildPortionFetchMetadata({
      applicationId: "1-1945-29108",
      gtldresultAcId: 170,
      resolvedUrl: "https://gtldresult.icann.org/x",
      httpStatus: 200,
      contentLength: 10,
      contentSha256: "a".repeat(64),
      retrievedAt: "2026-01-01T00:00:00.000Z",
      runId: "batch-1",
    });
    expect(record.httpStatus).toBe(200);
    expect(record.runId).toBe("batch-1");
  });

  it("splits pilot-live vs mapping-live auth and network policy", () => {
    expect(networkPolicyForCommand("pilot-live").requiresPilotLiveAuth).toBe(true);
    expect(networkPolicyForCommand("mapping-live").requiresMappingLiveAuth).toBe(true);
    expect(networkPolicyForCommand("pilot").allowsOutboundHttp).toBe(false);
    expect(isPilotLiveAuthorized()).toBe(false);
    expect(isMappingLiveAuthorized()).toBe(false);
  });

  it("preflight separates artifact rows from pilot resolution counts", async () => {
    const report = await buildPreflightReport({ workspaceRoot, operation: "pilot-live" });
    expect(report.artifactMappedCount).toBe(1);
    expect(report.pilotExpectedCount).toBe(25);
    expect(report.pilotResolvedCount).toBe(1);
    expect(report.pilotUnresolvedCount).toBe(24);
    const text = formatPreflightReport(report);
    expect(text).toContain("artifactMappedCount: 1");
    expect(text).not.toContain("mappedCount:");
  });
});
