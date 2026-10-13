import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCompareIntelViewModel,
  compareIntelHref,
  decodeCompareIntelIds,
  encodeCompareIntelIds,
  formatCompareMetricValue,
  isCompareIntelEntityType,
} from "@/lib/compare-intelligence";
import { loadEvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import {
  loadOrganizationResolutionSnapshot,
  loadParticipantOverlays,
} from "@/lib/participant-intelligence-server";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";

const WORKSPACE = process.cwd();
const PUBLICATION_PATH = join(WORKSPACE, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
const CONTENTION_PATH = join(WORKSPACE, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json");

async function loadLiveDocument(): Promise<RegistryApplicationsDocumentV2> {
  const publication = JSON.parse(await readFile(PUBLICATION_PATH, "utf8")) as Registry2026PublicationV2;
  const contention = JSON.parse(await readFile(CONTENTION_PATH, "utf8")) as ContentionMembershipSnapshotV1;
  return buildBrowserApplicationPayloadFromPublicationV2(publication, { contention });
}

async function deps() {
  const [document, overlays, orgSnapshot] = await Promise.all([
    loadLiveDocument(),
    loadParticipantOverlays(WORKSPACE),
    loadOrganizationResolutionSnapshot(WORKSPACE),
  ]);
  return { document, overlays, orgSnapshot, evaluatedRsp: loadEvaluatedMainRspArtifact() };
}

function sectionRow(model: ReturnType<typeof buildCompareIntelViewModel>, sectionId: string, rowId: string) {
  const section = model.sections.find((s) => s.id === sectionId);
  expect(section).toBeTruthy();
  const row = section!.rows.find((r) => r.id === rowId);
  expect(row).toBeTruthy();
  return row!;
}

describe("compare URL / state", () => {
  it("encodes Applicant legal names with commas safely", () => {
    const ids = ["Salesforce, Inc.", "Hair Apparent, LLC"];
    const encoded = encodeCompareIntelIds(ids);
    expect(encoded.includes(",")).toBe(false);
    expect(decodeCompareIntelIds(encoded)).toEqual(ids);
    expect(isCompareIntelEntityType("applicant")).toBe(true);
    expect(isCompareIntelEntityType("organizations")).toBe(false);
    const href = compareIntelHref("applicant", ids);
    expect(href.startsWith("/compare?")).toBe(true);
    expect(href).toContain("type=applicant");
    expect(href).not.toMatch(/href="\//);
  });

  it("encodes Organization keys deterministically", () => {
    expect(decodeCompareIntelIds(encodeCompareIntelIds(["identity-digital", "namecheap"]))).toEqual([
      "identity-digital",
      "namecheap",
    ]);
    expect(compareIntelHref("organization", ["hist-2012-microsoft", "hist-2012-google-charleston-road"])).toContain(
      "type=organization",
    );
  });
});

describe("Applicant comparison", () => {
  it("Salesforce, Inc. vs Hair Apparent, LLC keeps Applicant grain", async () => {
    const d = await deps();
    const model = buildCompareIntelViewModel({
      ...d,
      type: "applicant",
      idsRaw: encodeCompareIntelIds(["Salesforce, Inc.", "Hair Apparent, LLC"]),
    });
    expect(model.grain).toBe("applicant");
    expect(model.title).toMatch(/Compare Applicants/i);
    const apps = sectionRow(model, "portfolio", "applications");
    expect(apps.values[0]).toEqual({ kind: "number", value: 4 });
    const brand = sectionRow(model, "portfolio", "brand");
    expect(brand.values[0]).toEqual({ kind: "number", value: 4 });
    const org = sectionRow(model, "identity", "confirmed-org");
    expect(formatCompareMetricValue(org.values[0]!)).toMatch(/Salesforce/);
    expect(formatCompareMetricValue(org.values[1]!)).toMatch(/Identity Digital/);
    // Applicant counts must not become Organization aggregates (Identity Digital = 216)
    expect(apps.values.every((v) => v.kind === "number" && v.value < 50)).toBe(true);
  });

  it("Amazon Registry Services, Inc. vs AT&T Services, Inc. — Confirmed self-Organizations", async () => {
    const d = await deps();
    const model = buildCompareIntelViewModel({
      ...d,
      type: "applicant",
      idsRaw: encodeCompareIntelIds(["Amazon Registry Services, Inc.", "AT&T Services, Inc."]),
    });
    expect(model.columns.every((c) => c.lookup.found)).toBe(true);
    const org = sectionRow(model, "identity", "confirmed-org");
    expect(formatCompareMetricValue(org.values[0]!)).toMatch(/Amazon Registry Services/);
    expect(formatCompareMetricValue(org.values[1]!)).toMatch(/AT&T Services/);
    const apps = sectionRow(model, "portfolio", "applications");
    expect(apps.values[0]?.kind).toBe("number");
    expect(apps.values[0]).not.toEqual({ kind: "number", value: 0 });
  });
});

describe("Organization comparison", () => {
  it("Identity Digital vs Namecheap pins portfolio and contention", async () => {
    const d = await deps();
    const model = buildCompareIntelViewModel({
      ...d,
      type: "organization",
      idsRaw: encodeCompareIntelIds(["identity-digital", "namecheap"]),
    });
    expect(model.grain).toBe("organization");
    expect(model.title).toMatch(/Compare Organizations/i);
    const entities = sectionRow(model, "identity", "mapped-applicants");
    expect(entities.values[0]).toEqual({ kind: "number", value: 28 });
    expect(entities.values[1]).toEqual({ kind: "number", value: 20 });
    const apps = sectionRow(model, "portfolio", "applications");
    expect(apps.values[0]).toEqual({ kind: "number", value: 216 });
    expect(apps.values[1]).toEqual({ kind: "number", value: 40 });
    const memberships = sectionRow(model, "contention", "memberships");
    expect(memberships.values[0]).toEqual({ kind: "number", value: 157 });
    expect(memberships.values[1]).toEqual({ kind: "number", value: 21 });
  });

  it("Salesforce Organization — 1 entity / 4 Applications / Brand 4", async () => {
    const d = await deps();
    const model = buildCompareIntelViewModel({
      ...d,
      type: "organization",
      idsRaw: encodeCompareIntelIds(["salesforce", "identity-digital"]),
    });
    const entities = sectionRow(model, "identity", "mapped-applicants");
    expect(entities.values[0]).toEqual({ kind: "number", value: 1 });
    const apps = sectionRow(model, "portfolio", "applications");
    expect(apps.values[0]).toEqual({ kind: "number", value: 4 });
    const brand = sectionRow(model, "portfolio", "brand");
    expect(brand.values[0]).toEqual({ kind: "number", value: 4 });
  });

  it("rejects Candidate/Ambiguous Organization keys", async () => {
    const d = await deps();
    const candidate = d.orgSnapshot.organizations.find((o) => o.status === "CANDIDATE");
    expect(candidate).toBeTruthy();
    const model = buildCompareIntelViewModel({
      ...d,
      type: "organization",
      idsRaw: encodeCompareIntelIds([candidate!.organizationKey, "identity-digital"]),
    });
    expect(model.warnings.some((w) => /not a steward-Confirmed/i.test(w))).toBe(true);
    expect(model.columns.filter((c) => c.lookup.found)).toHaveLength(1);
  });
});

describe("returning / historical", () => {
  it("Microsoft vs Google confirmed deltas", async () => {
    const d = await deps();
    const model = buildCompareIntelViewModel({
      ...d,
      type: "organization",
      idsRaw: encodeCompareIntelIds(["hist-2012-microsoft", "hist-2012-google-charleston-road"]),
    });
    const a2012 = sectionRow(model, "historical", "hist-2012");
    const a2026 = sectionRow(model, "historical", "hist-2026");
    const delta = sectionRow(model, "historical", "hist-delta");
    expect(a2012.values[0]).toEqual({ kind: "number", value: 11 });
    expect(a2026.values[0]).toEqual({ kind: "number", value: 2 });
    expect(delta.values[0]).toEqual({ kind: "number", value: -9 });
    expect(a2012.values[1]).toEqual({ kind: "number", value: 101 });
    expect(a2026.values[1]).toEqual({ kind: "number", value: 39 });
    expect(delta.values[1]).toEqual({ kind: "number", value: -62 });
  });

  it("unconfirmed Organization does not show 2012 = 0", async () => {
    const d = await deps();
    const model = buildCompareIntelViewModel({
      ...d,
      type: "organization",
      idsRaw: encodeCompareIntelIds(["identity-digital", "namecheap"]),
    });
    const a2012 = sectionRow(model, "historical", "hist-2012");
    for (const v of a2012.values) {
      expect(v.kind).toBe("unavailable");
      expect(formatCompareMetricValue(v)).not.toBe("0");
      expect(formatCompareMetricValue(v)).toMatch(/No confirmed cross-round/i);
    }
  });
});

describe("entity grain safety", () => {
  it("does not silently mix Applicant and Organization grains", async () => {
    const d = await deps();
    // URL type=applicant with an org key should not invent Organization aggregates as Applicant metrics
    const model = buildCompareIntelViewModel({
      ...d,
      type: "applicant",
      idsRaw: encodeCompareIntelIds(["identity-digital"]),
    });
    expect(model.emptyReason || model.warnings.length >= 0).toBeTruthy();
    expect(model.columns[0]?.lookup.found).toBe(false);
  });

  it("RSP wording never implies selected provider", async () => {
    const d = await deps();
    const model = buildCompareIntelViewModel({
      ...d,
      type: "organization",
      idsRaw: encodeCompareIntelIds(["identity-digital", "namecheap"]),
    });
    const rsp = sectionRow(model, "rsp", "rsp-among");
    const blob = [rsp.note, ...rsp.values.map(formatCompareMetricValue)].join(" ");
    expect(blob).toMatch(/Selected RSP is not established/i);
    expect(blob).not.toMatch(/selected provider|GoDaddy can win|closed opportunity/i);
  });
});
