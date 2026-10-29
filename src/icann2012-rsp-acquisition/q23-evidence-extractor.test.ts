import { describe, expect, it } from "vitest";
import {
  HISTORICAL_RSP_EVIDENCE_CANDIDATE_SCHEMA_VERSION,
  HISTORICAL_RSP_EVIDENCE_EXTRACTION_SCHEMA_VERSION,
} from "./historical-rsp-evidence-candidate";
import {
  extractHistoricalRspEvidenceFromPublicPortionHtml,
  htmlToPlainText,
} from "./q23-evidence-extractor";
import { PUBLIC_PORTION_VERSION_BASIS } from "./public-portion-validation";

const APP_ID = "1-9999-00001";

function portionShell(body: string, applicationId = APP_ID): string {
  return `<!DOCTYPE html><html><body>
  <p>Application ID: ${applicationId}</p>
  ${body}
  </body></html>`;
}

function q23(content: string): string {
  return `<div id="q23"><h2>23. Registry Services</h2><p>${content}</p></div>`;
}

describe("RIH-2012-RSP-VISIBILITY-1A — Q23 offline evidence extraction", () => {
  it("A — extracts an explicit third-party provider candidate without confirmation", () => {
    const html = portionShell(
      q23(
        "The Applicant has selected NeuStar, Inc. to provide backend registry services for this application.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });

    expect(result.schemaVersion).toBe(HISTORICAL_RSP_EVIDENCE_EXTRACTION_SCHEMA_VERSION);
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.applicationId).toBe(APP_ID);
    expect(result.applicationVersionBasis).toBe(PUBLIC_PORTION_VERSION_BASIS);
    expect(result.candidates).toHaveLength(1);

    const candidate = result.candidates[0]!;
    expect(candidate.schemaVersion).toBe(HISTORICAL_RSP_EVIDENCE_CANDIDATE_SCHEMA_VERSION);
    expect(candidate.providerNameAsStated).toBe("NeuStar, Inc.");
    expect(candidate.sourceFieldPath).toBe("Q23");
    expect(candidate.evidenceClassification).toBe("PUBLIC_ICANN");
    expect(candidate.applicationVersionBasis).toBe("current_public_portion");
    expect(candidate.reviewState).toBe("REQUIRES_STEWARD_REVIEW");
    expect(candidate).not.toHaveProperty("rspKey");
    expect(JSON.stringify(candidate)).not.toMatch(/"CONFIRMED"/);
    expect(candidate.evidenceLocator).toMatch(/^Q23@\d+:\d+$/);
    expect(candidate.evidenceExcerpt?.length ?? 0).toBeGreaterThan(0);
    expect(candidate.evidenceExcerpt!.length).toBeLessThanOrEqual(240);
  });

  it("B — applicant legal name alone does not create an RSP candidate", () => {
    const html = portionShell(
      q23(
        "Example Applicant LLC is the Applicant. Example Applicant LLC maintains offices in Geneva. " +
          "Example Applicant LLC describes its corporate history. No registry service provider assignment is stated.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("NO_QUALIFYING_PROVIDER_ASSERTION");
    expect(result.candidates).toEqual([]);
  });

  it("C — corporate lineage names without assignment create no RSP candidate", () => {
    const html = portionShell(
      q23(
        "Public news mentions that GoDaddy later acquired NeuStar registry operations. " +
          "This narrative does not assign registry services for this Application.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("NO_QUALIFYING_PROVIDER_ASSERTION");
    expect(result.candidates).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/rspKey|GoDaddy Registry|SUCCESSION/i);
  });

  it("D — multiple explicit providers remain separate candidates", () => {
    const html = portionShell(`
      <div id="q23"><h2>23. Registry Services</h2>
        <p>The Applicant selected Afilias Limited to provide backend registry services.</p>
      </div>
      <div id="q24"><h2>24. Additional services</h2>
        <p>The Applicant partnered with VeriSign Naming Services to provide registry services for DNSSEC operations.</p>
      </div>
    `);
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates.map((c) => c.providerNameAsStated)).toEqual([
      "Afilias Limited",
      "VeriSign Naming Services",
    ]);
    expect(result.candidates.map((c) => c.sourceFieldPath)).toEqual(["Q23", "Q24"]);
    // Spelling preserved — no modern canonicalization
    expect(result.candidates.some((c) => c.providerNameAsStated === "Verisign")).toBe(false);
    expect(result.candidates.every((c) => c.reviewState === "REQUIRES_STEWARD_REVIEW")).toBe(true);
  });

  it("E — explicit self-operation records disposition without third-party candidate", () => {
    const html = portionShell(
      q23("The Applicant will provide the registry services itself. No external registry service provider will be engaged."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("EXPLICIT_SELF_OPERATED");
    expect(result.candidates).toEqual([]);
  });

  it("F — vendor near technical material without assignment is ambiguous", () => {
    const html = portionShell(
      q23(
        "Technical notes reference VeriSign DNSSEC materials published for general industry use. " +
          "No registry service provider is selected in this section.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("AMBIGUOUS_PROVIDER_RELATIONSHIP");
    expect(result.candidates).toEqual([]);
  });

  it("G — missing Q23 fails closed as unsupported basis", () => {
    const html = portionShell(
      `<p>Application ID: ${APP_ID}</p><p>This page has no registry services question.</p>`,
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("UNSUPPORTED_OR_MISSING_Q23_BASIS");
    expect(result.candidates).toEqual([]);
  });

  it("G — application-id mismatch fails closed as malformed/unusable", () => {
    const html = portionShell(q23("selected NeuStar, Inc. to provide backend registry services."), "1-0000-00000");
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("MALFORMED_OR_UNUSABLE_SECTION");
    expect(result.candidates).toEqual([]);
  });

  it("H — identical input yields identical structured output", () => {
    const html = portionShell(
      q23("The Applicant has selected NeuStar, Inc. to provide backend registry services."),
    );
    const a = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    const b = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(a).toEqual(b);
  });

  it("I — preserves provider wording and HTML entity decoding without identity mapping", () => {
    const html = portionShell(
      q23("The Applicant selected NeuStar&nbsp;Inc. to provide backend registry services."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates[0]?.providerNameAsStated).toBe("NeuStar Inc.");
    expect(result.candidates[0]?.providerNameAsStated).toContain("NeuStar");
    expect(result.candidates[0]?.providerNameAsStated).not.toBe("neustar");
    expect(result.candidates[0]?.providerNameAsStated).not.toMatch(/godaddy/i);
  });

  it("htmlToPlainText is mechanical and deterministic", () => {
    expect(htmlToPlainText("<p>A&amp;B</p><br/><b>C</b>")).toBe("A&B C");
  });
});

describe("RIH-2012-RSP-VISIBILITY-1A-R1 — negation and provider wording", () => {
  it("R1 — positive selected provider preserves NeuStar, Inc.", () => {
    const html = portionShell(
      q23("The Applicant selected NeuStar, Inc. to provide backend registry services."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.providerNameAsStated).toBe("NeuStar, Inc.");
  });

  it("R1 — negated selected produces zero positive candidates", () => {
    const html = portionShell(
      q23("The Applicant has not selected NeuStar, Inc. to provide backend registry services."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates).toEqual([]);
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
  });

  it("R1 — alternate negated selected (did not select) produces zero positive candidates", () => {
    const html = portionShell(
      q23("The Applicant did not select NeuStar, Inc. to provide backend registry services."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates).toEqual([]);
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
  });

  it("R1 — negated engaged produces zero positive candidates", () => {
    const html = portionShell(
      q23(
        "The Applicant has not engaged Example Registry Services, LLC to provide registry services.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates).toEqual([]);
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
  });

  it("R1 — provided by preserves NeuStar, Inc. punctuation", () => {
    const html = portionShell(q23("Registry services will be provided by NeuStar, Inc."));
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.providerNameAsStated).toBe("NeuStar, Inc.");
  });

  it("R1 — provided by preserves punctuation-bearing synthetic legal name", () => {
    const html = portionShell(
      q23("Registry services will be provided by Example Registry Services, LLC."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.providerNameAsStated).toBe("Example Registry Services, LLC");
  });

  it("R1 — negated provided-by cannot enter the positive path", () => {
    const html = portionShell(q23("Registry services will not be provided by NeuStar, Inc."));
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates).toEqual([]);
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
  });

  it("R1 — conflicting third-party and self-operated evidence stays reviewable", () => {
    const html = portionShell(
      q23(
        "The Applicant selected NeuStar, Inc. to provide backend registry services. " +
          "The Applicant will provide the registry services itself.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.reviewState).toBe("REQUIRES_STEWARD_REVIEW");
    expect(result.candidates[0]).not.toHaveProperty("rspKey");
    expect(result.notes.some((n) => /CONFLICT/i.test(n))).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/"CONFIRMED"/);
  });
});
