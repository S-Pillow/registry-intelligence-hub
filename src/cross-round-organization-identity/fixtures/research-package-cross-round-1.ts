import type { CrossRoundResearchPackage } from "../types";

const RETRIEVED = "2026-10-09";

/**
 * Bounded CROSS-ROUND-ID-1 research package.
 * Recommendations only — never steward-approved CONFIRMED cross-round identity.
 */
export const RESEARCH_PACKAGE_CROSS_ROUND_1: CrossRoundResearchPackage = {
  packageVersion: "cross-round-research-package/1.0.0",
  researchedAt: RETRIEVED,
  methodNote:
    "Evaluate all 14 CONFIRMED 2026 Organizations against the 16 CONFIRMED 2012 Organizations. Recommendations stay non-CONFIRMED pending steward (CROSS-ROUND-ID-1A).",
  dossiers: [
    {
      organization2026Id: "organization:resolved-2026:hist-2012-google-charleston-road",
      organization2026Key: "hist-2012-google-charleston-road",
      organization2012Id: "organization:promoted:google-charleston-road",
      organization2012Key: "google-charleston-road",
      relationshipType: "SAME_ORGANIZATION",
      reviewRecommendation: "CONFIRM",
      recommendationReason:
        "Exact Applicant legal name Charleston Road Registry Inc. is the confirmed 2012 Google (Charleston Road) portfolio participant and the confirmed 2026 Organization applicant; key lineage hist-2012-google-charleston-road ↔ google-charleston-road. Recommend continuous analytical identity — steward must still APPROVE.",
      temporalAssessment: {
        continuityClaim:
          "Same legal applicant entity Charleston Road Registry Inc. participates in both rounds as Google Registry vehicle",
        knownEvents: [
          "2012 Reveal Day: Charleston Road Registry Inc. promoted under google-charleston-road",
          "2026 Reveal Day: Charleston Road Registry Inc. confirmed as Organization with Google Registry first-party ownership evidence",
        ],
        acquisitionAfter2012: false,
        renameContinuity: false,
        stewardJudgmentRequired: true,
        limitations:
          "Parent Google branding is continuous but steward should confirm no intermediate reassignment of the legal applicant identity",
      },
      notes: "Discovery via key lineage + possible2012 hint + exact applicant alias overlap. Not auto-confirmed.",
      evidence: [
        {
          evidenceId: "xri-ev-crr-2012-promotion",
          strength: "A",
          sourceType: "icann-2012-promotion",
          sourceIdentifier: "organization-promotion/1.0.0#org-prom-2012-google-charleston-road",
          title: "2012 steward-confirmed promotion — google-charleston-road",
          evidenceAsOf: "2012-06-13",
          retrievedAt: RETRIEVED,
          summary:
            "Accepted 2012 Organization promotion maps Charleston Road Registry Inc. applications to google-charleston-road.",
          supportsClaim:
            "2012 confirmed Organization identity is organization:promoted:google-charleston-road",
          temporalRelevance: "2012 Reveal Day steward-confirmed portfolio",
          limitations: "Does not alone prove 2026 continuity without matching 2026 entity evidence",
        },
        {
          evidenceId: "xri-ev-crr-2026-applicant-continuity",
          strength: "B",
          sourceType: "icann-public-summary",
          sourceIdentifier: "organization-resolution-2026/1.0.0#Charleston Road Registry Inc.",
          title: "2026 confirmed Organization — Charleston Road Registry Inc.",
          evidenceAsOf: "2026-10-07",
          retrievedAt: RETRIEVED,
          summary:
            "ORG-RES-2026-2A steward-confirmed 2026 Organization for exact Applicant legal name Charleston Road Registry Inc.",
          supportsClaim: "2026 confirmed Organization uses the same Applicant legal name as 2012 CRR portfolio",
          temporalRelevance: "2026 Reveal Day APS + steward approval 2026-10-09",
          limitations: "Applicant Name continuity is strong but still requires steward cross-round approval",
        },
      ],
    },
    {
      organization2026Id: "organization:resolved-2026:hist-2012-microsoft",
      organization2026Key: "hist-2012-microsoft",
      organization2012Id: "organization:promoted:microsoft",
      organization2012Key: "microsoft",
      relationshipType: "SAME_ORGANIZATION",
      reviewRecommendation: "CONFIRM",
      recommendationReason:
        "Exact legal name Microsoft Corporation matches confirmed 2012 microsoft Organization and confirmed 2026 Organization; key lineage hist-2012-microsoft ↔ microsoft.",
      temporalAssessment: {
        continuityClaim: "Same legal registrant Microsoft Corporation across 2012 and 2026 rounds",
        knownEvents: [
          "2012: Microsoft Corporation steward-confirmed under microsoft",
          "2026: Microsoft Corporation steward-confirmed under hist-2012-microsoft with SEC 10-K identity evidence",
        ],
        acquisitionAfter2012: false,
        renameContinuity: false,
        stewardJudgmentRequired: true,
        limitations: "Portfolio size changed; identity continuity ≠ portfolio-change classification yet",
      },
      notes: "Discovery via key lineage + canonical/exact name overlap. Recommendation only.",
      evidence: [
        {
          evidenceId: "xri-ev-msft-2012-promotion",
          strength: "A",
          sourceType: "icann-2012-promotion",
          sourceIdentifier: "organization-promotion/1.0.0#org-prom-2012-microsoft",
          title: "2012 steward-confirmed promotion — microsoft",
          evidenceAsOf: "2012-06-13",
          retrievedAt: RETRIEVED,
          summary: "Accepted 2012 promotion maps Microsoft Corporation applications to microsoft.",
          supportsClaim: "2012 confirmed Organization identity is organization:promoted:microsoft",
          temporalRelevance: "2012 Reveal Day steward-confirmed portfolio",
          limitations: "Historical confirmation only",
        },
        {
          evidenceId: "xri-ev-msft-2026-sec",
          strength: "A",
          sourceType: "sec-filing",
          sourceIdentifier:
            "https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm",
          title: "Microsoft Corporation Form 10-K (period ended 2026-06-30)",
          evidenceAsOf: "2026-06-30",
          retrievedAt: RETRIEVED,
          summary: "SEC registrant Microsoft Corporation aligns with APS Applicant legal name.",
          supportsClaim: "2026 Organization is the same legal registrant Microsoft Corporation",
          temporalRelevance: "Covers application window into Reveal Day",
          limitations: "Does not enumerate gTLD portfolio continuity",
        },
      ],
    },
    {
      organization2026Id: "organization:resolved-2026:godaddy-registry-services",
      organization2026Key: "godaddy-registry-services",
      organization2012Id: "organization:promoted:uniregistry",
      organization2012Key: "uniregistry",
      relationshipType: "ACQUIRED_AFTER_2012",
      reviewRecommendation: "REJECT",
      recommendationReason:
        "GoDaddy (Registry Services, LLC) is related to Uniregistry via post-2012 acquisition of Uniregistry registry assets/business, but the 2012 confirmed participant was Uniregistry, Corp. — not GoDaddy. Do not rewrite the 2012 participant as GoDaddy.",
      temporalAssessment: {
        continuityClaim:
          "Commercial succession via acquisition does not equal same analytical Organization identity for 2012↔2026 returning comparison",
        knownEvents: [
          "2012: Uniregistry, Corp. steward-confirmed (54 apps)",
          "Post-2012: GoDaddy acquired Uniregistry registry business",
          "2026: Registry Services, LLC confirmed as GoDaddy Organization",
        ],
        acquisitionAfter2012: true,
        renameContinuity: false,
        stewardJudgmentRequired: true,
        limitations:
          "Acquisition creates RELATED / ACQUIRED_AFTER_2012 semantics — not SAME_ORGANIZATION returning identity",
      },
      notes: "Documented to prevent acquisition-as-returning error. Recommendation REJECT same identity.",
      evidence: [
        {
          evidenceId: "xri-ev-godaddy-uniregistry-2012",
          strength: "A",
          sourceType: "icann-2012-promotion",
          sourceIdentifier: "organization-promotion/1.0.0#org-prom-2012-uniregistry",
          title: "2012 steward-confirmed Uniregistry portfolio",
          evidenceAsOf: "2012-06-13",
          retrievedAt: RETRIEVED,
          summary: "2012 confirmed Organization is Uniregistry, Corp., not GoDaddy.",
          supportsClaim: "Historical participant identity is organization:promoted:uniregistry",
          temporalRelevance: "2012 Reveal Day",
          limitations: "Does not describe later ownership changes",
        },
        {
          evidenceId: "xri-ev-godaddy-acquisition-after-2012",
          strength: "B",
          sourceType: "acquisition-announcement",
          sourceIdentifier: "https://aboutus.godaddy.net/newsroom/press-releases/",
          title: "GoDaddy / Uniregistry registry acquisition (post-2012)",
          evidenceAsOf: "2020-01-01",
          retrievedAt: RETRIEVED,
          summary:
            "Public first-party/industry record that GoDaddy acquired Uniregistry registry assets after the 2012 round.",
          supportsClaim: "Ownership change occurred after 2012 — acquiring parent ≠ 2012 participant",
          temporalRelevance: "Post-2012 corporate event",
          limitations:
            "Exact closing date nuances do not change the analytical rule: post-2012 acquisition ≠ SAME_ORGANIZATION",
        },
      ],
    },
    {
      organization2026Id: "organization:resolved-2026:echostar",
      organization2026Key: "echostar",
      organization2012Id: "organization:promoted:dish",
      organization2012Key: "dish",
      relationshipType: "SUCCESSOR_ENTITY_REVIEW_REQUIRED",
      reviewRecommendation: "AMBIGUOUS",
      recommendationReason:
        "ECHO Domain Co / EchoStar is corporately related to the 2012 Dish DBS portfolio through EchoStar–DISH corporate history, but reorganizations/mergers require explicit steward judgment before SAME_ORGANIZATION.",
      temporalAssessment: {
        continuityClaim:
          "Possible continuous parent/family identity, but merger/reorganization path is not auto-decidable",
        knownEvents: [
          "2012: Dish DBS Corporation steward-confirmed",
          "Post-2012: EchoStar / DISH corporate reorganizations and combination events",
          "2026: ECHO Domain Co L.L.C. confirmed under EchoStar Corporation",
        ],
        acquisitionAfter2012: false,
        renameContinuity: false,
        stewardJudgmentRequired: true,
        limitations: "Related corporate family ≠ automatic analytical identity continuity",
      },
      notes: "Multiple plausible continuity readings → AMBIGUOUS pending steward.",
      evidence: [
        {
          evidenceId: "xri-ev-echostar-dish-2012",
          strength: "A",
          sourceType: "icann-2012-promotion",
          sourceIdentifier: "organization-promotion/1.0.0#org-prom-2012-dish",
          title: "2012 steward-confirmed Dish DBS portfolio",
          evidenceAsOf: "2012-06-13",
          retrievedAt: RETRIEVED,
          summary: "2012 confirmed Organization is Dish DBS Corporation.",
          supportsClaim: "Historical candidate identity is organization:promoted:dish",
          temporalRelevance: "2012 Reveal Day",
          limitations: "Does not establish 2026 EchoStar legal continuity alone",
        },
        {
          evidenceId: "xri-ev-echostar-2026-org",
          strength: "B",
          sourceType: "first-party-corporate",
          sourceIdentifier: "organization-resolution-2026/1.0.0#ECHO Domain Co L.L.C.",
          title: "2026 confirmed EchoStar / ECHO Domain Organization",
          evidenceAsOf: "2026-10-07",
          retrievedAt: RETRIEVED,
          summary: "2026 confirmed Organization canonicalizes to EchoStar Corporation via ECHO Domain Co L.L.C.",
          supportsClaim: "2026 participant is EchoStar-family registry vehicle",
          temporalRelevance: "2026 Reveal Day",
          limitations: "Family relationship needs steward temporal judgment vs Dish 2012 identity",
        },
      ],
    },
    // Explicit NO_MATCH dossiers for remaining confirmed 2026 Organizations
    ...(
      [
        ["aruba-spa", "Aruba S.P.A. / Aruba PEC — no confirmed 2012 Organization in the accepted 16"],
        ["automattic", "Automattic / Knock Knock WHOIS There — not in confirmed 2012 Organization subset"],
        ["intercap-registry", "Intercap Registry Inc. — not in confirmed 2012 Organization subset"],
        ["link-freedom-group", "Link Freedom Group Ltd — not in confirmed 2012 Organization subset"],
        ["meta-platforms", "Meta Platforms / Meta Registry Holdings — not in confirmed 2012 Organization subset"],
        ["openai-group-pbc", "OpenAI Group PBC — not in confirmed 2012 Organization subset"],
        [
          "radix-technologies",
          "Radix Technologies — may have historical 2012 participation elsewhere, but not in the confirmed 2012 subset; unmatched ≠ NEW",
        ],
        ["shortdot-sa", "ShortDot — not in confirmed 2012 Organization subset"],
        [
          "squarespace-inc",
          "Squarespace Registry — post-2012 registry entrant/acquirer context; no SAME match to confirmed 2012 Organizations (including Google CRR)",
        ],
        [
          "xyz-com-llc",
          "XYZ.COM LLC — not among the 16 confirmed 2012 Organizations; unmatched ≠ NEW",
        ],
      ] as const
    ).map(([key, reason]) => ({
      organization2026Id: `organization:resolved-2026:${key}`,
      organization2026Key: key,
      organization2012Id: null,
      organization2012Key: null,
      relationshipType: "NO_PLAUSIBLE_CONFIRMED_2012_MATCH" as const,
      reviewRecommendation: "NO_MATCH" as const,
      recommendationReason: reason,
      temporalAssessment: {
        continuityClaim: "No defensible continuity claim against the confirmed 2012 Organization universe",
        knownEvents: [],
        acquisitionAfter2012: false,
        renameContinuity: false,
        stewardJudgmentRequired: false,
        limitations:
          "Confirmed-2012 universe is partial (16/466). Unmatched does not authorize NEW classification.",
      },
      notes: "Explicit unmatched row for operator review — do not hide.",
      evidence: [
        {
          evidenceId: `xri-ev-nomatch-${key}`,
          strength: "D" as const,
          sourceType: "steward-note" as const,
          sourceIdentifier: "cross-round-organization-identity/1.0.0#no-plausible-confirmed-2012-match",
          title: "No plausible confirmed-2012 match",
          evidenceAsOf: RETRIEVED,
          retrievedAt: RETRIEVED,
          summary:
            "Exhaustive review of 16 confirmed 2012 Organizations found no defensible SAME/RENAME continuity candidate.",
          supportsClaim: "No confirmed-2012 analytical identity candidate for this 2026 Organization",
          temporalRelevance: "Cross-round research pass 2026-10-09",
          limitations: "Name similarity alone intentionally excluded as proof",
        },
      ],
    })),
  ],
};
