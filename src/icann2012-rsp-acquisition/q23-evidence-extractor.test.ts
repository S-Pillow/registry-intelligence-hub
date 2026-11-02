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

  it("1H4 — canonical ICANN Q23 prompt isolates a section without inventing provider facts", () => {
    const html = portionShell(`
      <p>Registry Services</p>
      <p>23. Provide name and full description of all the Registry Services to be provided</p>
      <p>Synthetic Q23 narrative with no registry-services provider assignment.</p>
      <div id="q24"><h2>24. Shared Registration System</h2>
        <p>MARKER_Q24_ONLY — must not be treated as the only Q23 body.</p>
      </div>
    `);
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("NO_QUALIFYING_PROVIDER_ASSERTION");
    expect(result.candidates).toEqual([]);
    expect(result.applicationId).toBe(APP_ID);
    expect(result.applicationVersionBasis).toBe(PUBLIC_PORTION_VERSION_BASIS);
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

describe("RIH-2012-RSP-VISIBILITY-1A-R2 — assertion and provider-span boundaries", () => {
  it("R2 — provided by stops at sentence boundary (Afilias Limited)", () => {
    const html = portionShell(
      q23(
        "Registry services will be provided by Afilias Limited. The Applicant will operate the remaining systems.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.providerNameAsStated).toBe("Afilias Limited");
  });

  it("R2 — provided by stops at sentence boundary (VeriSign Naming Services)", () => {
    const html = portionShell(
      q23("Registry services will be provided by VeriSign Naming Services. DNSSEC is described below."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates[0]?.providerNameAsStated).toBe("VeriSign Naming Services");
  });

  it("R2 — provided by keeps NeuStar, Inc. then stops before next sentence", () => {
    const html = portionShell(
      q23("Registry services will be provided by NeuStar, Inc. The Applicant describes DNS separately."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates[0]?.providerNameAsStated).toBe("NeuStar, Inc.");
  });

  it("R2 — provided by keeps Example Registry Services, LLC then stops", () => {
    const html = portionShell(
      q23(
        "Registry services will be provided by Example Registry Services, LLC. The Applicant describes DNS separately.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates[0]?.providerNameAsStated).toBe("Example Registry Services, LLC");
  });

  it("R2 — does not intend to select yields zero positive candidates", () => {
    const html = portionShell(
      q23(
        "The Applicant does not intend to select NeuStar, Inc. to provide backend registry services.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates).toEqual([]);
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
  });

  it("R2 — does not plan to select yields zero positive candidates", () => {
    const html = portionShell(
      q23(
        "The Applicant does not plan to select NeuStar, Inc. to provide backend registry services.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates).toEqual([]);
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
  });

  it("R2 — may select yields zero positive candidates", () => {
    const html = portionShell(
      q23("The Applicant may select NeuStar, Inc. to provide backend registry services."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates).toEqual([]);
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
  });

  it("R2 — could select yields zero positive candidates", () => {
    const html = portionShell(
      q23("The Applicant could select NeuStar, Inc. to provide backend registry services."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates).toEqual([]);
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
  });

  it("R2 — hypothetical were to select yields zero positive candidates", () => {
    const html = portionShell(
      q23(
        "If the Applicant were to select NeuStar, Inc. to provide backend registry services, further review would follow.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates).toEqual([]);
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
  });

  it("R2 — ordinary asserted selected remains a positive exact candidate", () => {
    const html = portionShell(
      q23("The Applicant selected NeuStar, Inc. to provide backend registry services."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates[0]?.providerNameAsStated).toBe("NeuStar, Inc.");
  });

  it("R2 — provider-will-provide is sentence-local (Afilias Limited only)", () => {
    const html = portionShell(
      q23("Afilias Limited will provide backend registry services for the Applicant."),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.providerNameAsStated).toBe("Afilias Limited");
    expect(result.candidates[0]?.providerNameAsStated).not.toMatch(/23|Registry Services/i);
  });

  it("R2 — preceding prose does not leak into provider-will-provide name", () => {
    const html = portionShell(
      q23(
        "The technical model is described below. Afilias Limited will provide backend registry services for the Applicant.",
      ),
    );
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates[0]?.providerNameAsStated).toBe("Afilias Limited");
  });
});

describe("RIH-2012-RSP-VISIBILITY-1A-R3 — affirmative assertion grammar lock", () => {
  function expectNoPositive(content: string) {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(portionShell(q23(content)), {
      expectedApplicationId: APP_ID,
    });
    expect(result.candidates).toEqual([]);
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
  }

  function expectProvider(content: string, provider: string) {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(portionShell(q23(content)), {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates.map((c) => c.providerNameAsStated)).toEqual([provider]);
  }

  it("R3 — may have selected is non-positive", () => {
    expectNoPositive(
      "The Applicant may have selected NeuStar, Inc. to provide backend registry services.",
    );
  });

  it("R3 — might have engaged is non-positive", () => {
    expectNoPositive(
      "The Applicant might have engaged Example Registry Services, LLC to provide registry services.",
    );
  });

  it("R3 — could have selected is non-positive", () => {
    expectNoPositive(
      "The Applicant could have selected NeuStar, Inc. to provide registry services.",
    );
  });

  it("R3 — would have selected is non-positive", () => {
    expectNoPositive(
      "The Applicant would have selected NeuStar, Inc. to provide registry services.",
    );
  });

  it("R3 — did not ultimately select is non-positive", () => {
    expectNoPositive(
      "The Applicant did not ultimately select NeuStar, Inc. to provide registry services.",
    );
  });

  it("R3 — has never actually selected is non-positive", () => {
    expectNoPositive(
      "The Applicant has never actually selected NeuStar, Inc. to provide registry services.",
    );
  });

  it("R3 — was expected to select is non-positive", () => {
    expectNoPositive(
      "The Applicant was expected to select NeuStar, Inc. to provide registry services.",
    );
  });

  it("R3 — was considering whether to select is non-positive", () => {
    expectNoPositive(
      "The Applicant was considering whether to select NeuStar, Inc. to provide registry services.",
    );
  });

  it("R3 — if approved may select is non-positive", () => {
    expectNoPositive(
      "If approved, the Applicant may select NeuStar, Inc. to provide registry services.",
    );
  });

  it("R3 — intends to select is non-positive", () => {
    expectNoPositive(
      "The Applicant intends to select NeuStar, Inc. to provide registry services.",
    );
  });

  it("R3 — arbitrary prose before select token cannot create evidence", () => {
    expectNoPositive(
      "The Applicant's board discussed whether it might eventually select NeuStar, Inc. to provide backend registry services.",
    );
  });

  it("R3 — positive control selected", () => {
    expectProvider(
      "The Applicant selected NeuStar, Inc. to provide backend registry services.",
      "NeuStar, Inc.",
    );
  });

  it("R3 — positive control has selected", () => {
    expectProvider(
      "The Applicant has selected NeuStar, Inc. to provide backend registry services.",
      "NeuStar, Inc.",
    );
  });

  it("R3 — positive control engaged", () => {
    expectProvider(
      "The Applicant engaged Example Registry Services, LLC to provide registry services.",
      "Example Registry Services, LLC",
    );
  });

  it("R3 — positive control partnered with", () => {
    expectProvider(
      "The Applicant partnered with VeriSign Naming Services to provide registry services.",
      "VeriSign Naming Services",
    );
  });

  it("R3 — positive control provided by", () => {
    expectProvider("Registry services will be provided by NeuStar, Inc.", "NeuStar, Inc.");
  });

  it("R3 — positive control provider will provide for Applicant", () => {
    expectProvider(
      "Afilias Limited will provide backend registry services for the Applicant.",
      "Afilias Limited",
    );
  });
});

describe("RIH-2012-RSP-VISIBILITY-1A-R4 — provider-span completeness gate", () => {
  function extract(content: string) {
    return extractHistoricalRspEvidenceFromPublicPortionHtml(portionShell(q23(content)), {
      expectedApplicationId: APP_ID,
    });
  }

  function expectNoTruncatedPrefix(content: string, forbiddenPrefix: string) {
    const result = extract(content);
    const names = result.candidates.map((c) => c.providerNameAsStated);
    // Forbidden: emit the truncated prefix as providerNameAsStated.
    expect(names).not.toContain(forbiddenPrefix);
    // Acceptable: fail closed (preferred) or a complete longer exact name.
    if (result.candidates.length === 0) {
      expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
    } else {
      expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
      expect(names.every((n) => n.length > forbiddenPrefix.length)).toBe(true);
    }
  }

  it("R4 — provided-by lowercase connector must not emit truncated CORE Internet Council", () => {
    expectNoTruncatedPrefix(
      "Registry services will be provided by CORE Internet Council of Registrars.",
      "CORE Internet Council",
    );
  });

  it("R4 — provided-by unsupported S.A. suffix must not emit truncated Example Registry Services", () => {
    expectNoTruncatedPrefix(
      "Registry services will be provided by Example Registry Services, S.A.",
      "Example Registry Services",
    );
  });

  it("R4 — RSP-label lowercase connector must not emit truncated CORE Internet Council", () => {
    expectNoTruncatedPrefix(
      "Registry Service Provider: CORE Internet Council of Registrars.",
      "CORE Internet Council",
    );
  });

  it("R4 — RSP-label unsupported S.A. suffix must not emit truncated Example Registry Services", () => {
    expectNoTruncatedPrefix(
      "Registry Service Provider: Example Registry Services, S.A.",
      "Example Registry Services",
    );
  });

  it("R4 — provided-by NeuStar, Inc. remains exact positive", () => {
    const result = extract("Registry services will be provided by NeuStar, Inc.");
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates.map((c) => c.providerNameAsStated)).toEqual(["NeuStar, Inc."]);
  });

  it("R4 — provided-by Afilias Limited remains exact positive", () => {
    const result = extract("Registry services will be provided by Afilias Limited.");
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates.map((c) => c.providerNameAsStated)).toEqual(["Afilias Limited"]);
  });

  it("R4 — provided-by Example Registry Services, LLC remains exact positive", () => {
    const result = extract(
      "Registry services will be provided by Example Registry Services, LLC.",
    );
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates.map((c) => c.providerNameAsStated)).toEqual([
      "Example Registry Services, LLC",
    ]);
  });

  it("R4 — RSP-label NeuStar, Inc. remains exact positive", () => {
    const result = extract("Registry Service Provider: NeuStar, Inc.");
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates.map((c) => c.providerNameAsStated)).toEqual(["NeuStar, Inc."]);
  });
});

describe("RIH-2012-RSP-VISIBILITY-1H8 — steward-verified assignment grammar", () => {
  function assertExplicitCandidate(
    content: string,
    providerNameAsStated: string,
    sourceFieldPath: "Q23" | "Q24" | "Q25" = "Q23",
  ) {
    const body =
      sourceFieldPath === "Q23"
        ? q23(content)
        : sourceFieldPath === "Q24"
          ? `<div id="q23"><h2>23. Registry Services</h2><p>Technical overview follows.</p></div><div id="q24"><h2>24. Additional services</h2><p>${content}</p></div>`
          : `<div id="q23"><h2>23. Registry Services</h2><p>Technical overview follows.</p></div><div id="q25"><h2>25. EPP</h2><p>${content}</p></div>`;
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(portionShell(body), {
      expectedApplicationId: APP_ID,
    });
    expect(result.disposition).toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0]!;
    expect(candidate.providerNameAsStated).toBe(providerNameAsStated);
    expect(candidate.sourceFieldPath).toBe(sourceFieldPath);
    expect(candidate.evidenceClassification).toBe("PUBLIC_ICANN");
    expect(candidate.applicationVersionBasis).toBe("current_public_portion");
    expect(candidate.reviewState).toBe("REQUIRES_STEWARD_REVIEW");
    expect(candidate).not.toHaveProperty("rspKey");
    expect(JSON.stringify(candidate)).not.toMatch(/"CONFIRMED"/);
    expect(candidate.evidenceLocator).toMatch(new RegExp(`^${sourceFieldPath}@\\d+:\\d+$`));
    expect(candidate.evidenceExcerpt?.length ?? 0).toBeGreaterThan(0);
    expect(candidate.evidenceExcerpt!.length).toBeLessThanOrEqual(240);
    return result;
  }

  it("1H8 — elected to partner with provider for back-end services", () => {
    assertExplicitCandidate(
      "Example Applicant LLC has elected to partner with Example Back-End Provider, Inc. to provide back-end services for the registry.",
      "Example Back-End Provider, Inc.",
    );
  });

  it("1H8 — outsource the entirety of technical operations to provider", () => {
    assertExplicitCandidate(
      "Example Operator LLC will outsource the entirety of its technical operations to Example Cloud Registry.",
      "Example Cloud Registry",
    );
  });

  it("1H8 — provider-role appositive (back-end provider of registry services)", () => {
    assertExplicitCandidate(
      "Answers are provided directly from Example Registry Co, the back-end provider of registry services for this TLD.",
      "Example Registry Co",
    );
  });

  it("1H8 — engaged provider to deliver services", () => {
    assertExplicitCandidate(
      "We have engaged Example Registry Services (ERS) to deliver services for this TLD.",
      "Example Registry Services (ERS)",
    );
  });

  it("1H8 — engaged provider to deliver registry services (has engaged)", () => {
    assertExplicitCandidate(
      "Example Authority Body has engaged the Regional Registry Authority UAE (RRA) to deliver registry services for this TLD.",
      "Regional Registry Authority UAE (RRA)",
    );
  });

  it("1H8 — passive selected to provide back-end services", () => {
    assertExplicitCandidate(
      "Example Provider, Inc., in turn, has been selected by Example Manager to provide back-end services for the registry.",
      "Example Provider, Inc.",
    );
  });

  it("1H8 — selected as the back-end registry services provider", () => {
    assertExplicitCandidate(
      "Example Provider, Inc. has been selected as the back-end registry services provider for this TLD.",
      "Example Provider, Inc.",
    );
  });

  it("1H8 — selected backend registry services provider, PROVIDER", () => {
    assertExplicitCandidate(
      "Oversight includes Example Applicant's selected backend registry services provider, Verisign Inc (VSI).",
      "Verisign Inc (VSI)",
      "Q24",
    );
  });

  it("1H8 — retained as the Registry Back-End Service Provider", () => {
    assertExplicitCandidate(
      'The Registry Operator has retained China Example Network Information Center (CENIC) as "the Registry Back-End Service Provider" of this TLD.',
      "China Example Network Information Center (CENIC)",
      "Q25",
    );
  });

  it("1H8 — registry operations outsourced to and performed by provider", () => {
    assertExplicitCandidate(
      "Registry operations are outsourced to and performed by Internet Example Consortium, Inc (IEC).",
      "Internet Example Consortium, Inc (IEC)",
    );
  });

  it("1H8 — planning to outsource technical operation to partner company", () => {
    assertExplicitCandidate(
      "We are planning to outsource the technical operation of gTLD to our partner company Example Registrar s.r.o.",
      "Example Registrar s.r.o.",
    );
  });

  it("1H8 — provider-span legal suffix Inc. preserved", () => {
    assertExplicitCandidate(
      "Example Applicant LLC has elected to partner with NeuStar, Inc. to provide back-end services for the registry.",
      "NeuStar, Inc.",
    );
  });

  it("1H8 — provider-span does not absorb following prose after parenthetical alias", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(
        q23(
          "We have engaged Example Registry Services (ERS) to deliver services for this TLD. Additional prose about DNSSEC materials follows.",
        ),
      ),
      { expectedApplicationId: APP_ID },
    );
    expect(result.candidates[0]!.providerNameAsStated).toBe("Example Registry Services (ERS)");
    expect(result.candidates[0]!.providerNameAsStated.includes("Additional")).toBe(false);
  });

  it("1H8 — provider-span rejects descriptive parenthetical over-capture", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(
        q23(
          "Registry operations are outsourced to and performed by Example Systems Consortium (including managed DNS).",
        ),
      ),
      { expectedApplicationId: APP_ID },
    );
    // Incomplete span after name (descriptive parenthetical) — fail closed, no truncated candidate.
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toEqual([]);
  });

  it("1H8 — Verisign system/security description remains non-assignment", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(
        q23(
          "Verisign provides a comprehensive system and physical security solution that is designed to ensure a TLD is protected. " +
            "Verisign's Shared Registration System (SRS) supports the IETF Extensible Provisioning Protocol (EPP) specifications.",
        ),
      ),
      { expectedApplicationId: APP_ID },
    );
    expect(result.candidates).toEqual([]);
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.disposition).not.toBe("EXPLICIT_SELF_OPERATED");
  });

  it("1H8 — vendor near SRS/EPP/DNS without assignment stays ambiguous-capable", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(
        q23(
          "The technical model references ExampleVendor SRS materials and EPP documentation without assigning a registry service provider.",
        ),
      ),
      { expectedApplicationId: APP_ID },
    );
    expect(result.candidates).toEqual([]);
    expect(result.disposition).toBe("AMBIGUOUS_PROVIDER_RELATIONSHIP");
  });

  it("1H8 — partner with X without backend/service role is non-positive", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(q23("Example Applicant LLC has elected to partner with Example Vendor for marketing support.")),
      { expectedApplicationId: APP_ID },
    );
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toEqual([]);
  });

  it("1H8 — selected X without backend/provider role is non-positive", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(q23("Example Applicant LLC has selected Example Vendor for office furniture.")),
      { expectedApplicationId: APP_ID },
    );
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toEqual([]);
  });

  it("1H8 — engaged X without service role is non-positive", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(q23("Example Applicant LLC has engaged Example Counsel for trademark filings.")),
      { expectedApplicationId: APP_ID },
    );
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toEqual([]);
  });

  it("1H8 — generic outsourcing discussion without provider target is non-positive", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(
        q23("The Applicant may consider outsourcing technical operations in the future if needed."),
      ),
      { expectedApplicationId: APP_ID },
    );
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toEqual([]);
  });

  it("1H8 — future/conditional planning outside verified partner-company form is non-positive", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(
        q23("We are planning to outsource some network monitoring to an unnamed vendor someday."),
      ),
      { expectedApplicationId: APP_ID },
    );
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toEqual([]);
  });

  it("1H8 — company appositive without explicit provider role is non-positive", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(
        q23("Answers are provided directly from Example Registry Co, the corporate affiliate of the Applicant."),
      ),
      { expectedApplicationId: APP_ID },
    );
    expect(result.disposition).not.toBe("EXPLICIT_PROVIDER_CANDIDATE");
    expect(result.candidates).toEqual([]);
  });

  it("1H8 — named company is registry services provider does not become self-operated", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(
        q23(
          "Registry services for this TLD will be performed by Example Named Operator. Example Named Operator is the registry services provider for this and several other TLD applications.",
        ),
      ),
      { expectedApplicationId: APP_ID },
    );
    expect(result.disposition).not.toBe("EXPLICIT_SELF_OPERATED");
  });

  it("1H8 — named company will serve as registry operator does not become self-operated", () => {
    const result = extractHistoricalRspEvidenceFromPublicPortionHtml(
      portionShell(
        q23('Example Named Operator, Inc ("ENO") will serve as the registry operator for the .example registry.'),
      ),
      { expectedApplicationId: APP_ID },
    );
    expect(result.disposition).not.toBe("EXPLICIT_SELF_OPERATED");
    expect(result.candidates).toEqual([]);
  });
});
