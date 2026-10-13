/**
 * ORG-RES-TRANCHE-1A — build committed evidence package from curated research notes.
 * Does not apply steward approvals or mutate product resolution.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const enriched = JSON.parse(readFileSync("/tmp/tranche1a-enriched.json", "utf8"));
const byName = Object.fromEntries(enriched.map((o) => [o.name, o]));

const REVEAL = "2026-10-07";
const RETRIEVED = "2026-10-13";

function ev(partial) {
  return {
    temporalRelevance:
      partial.temporalRelevance ??
      "APS Application materials for 2026 Reveal Day application period",
    asOf: partial.asOf ?? REVEAL,
    retrievedAt: partial.retrievedAt ?? RETRIEVED,
    ...partial,
  };
}

function base(name, fields) {
  const o = byName[name];
  if (!o) throw new Error(`missing enriched row for ${name}`);
  return {
    applicantLegalName: name,
    representativeApplicationId: o.rep,
    applicationCount: o.apps,
    brandApplicationCount: o.brand,
    officialContentionMembershipCount: o.cont,
    distinctContentionSetCount: o.sets,
    representativeApplicationIds: o.ids.slice(0, 8),
    lanes: o.lanes,
    priorResolutionState: "UNRESOLVED",
    applicantWebsiteHost: o.host,
    applicantWebsiteUrl: o.url,
    potentialPublicMainRspMatch: false,
    crossRoundIdentityCreated: false,
    ...fields,
  };
}

const surfaces = [
  "Organization Profile",
  "Organization Compare",
  "Competitive Landscape",
  "Contention",
  "future Change Organization context",
];

/** @type {import("../src/organization-resolution-2026/applicant-identity/types").IdentityEvidenceDossier[]} */
const research = [];

function add(d) {
  research.push(d);
}

// ——— CONFIRM ———
add(
  base("Amazon Registry Services, Inc.", {
    candidateOrganizationKey: "amazon",
    candidateCanonicalName: "Amazon",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS Q12 states Amazon Registry Services, Inc. is 100% owned by Amazon.com, Inc. and is an existing registry operator; Q108 ultimate control Amazon.com, Inc. Organization Amazon; parents/control stored separately.",
    requiredStewardAction:
      "APPROVE Confirmed · Amazon for Applicant Amazon Registry Services, Inc. or REJECT — recommendation only; not product-eligible until steward APPROVE",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: "Amazon.com, Inc.",
    ultimateParentLegalName: "Amazon.com, Inc.",
    ultimateControlLegalName: "Amazon.com, Inc.",
    evidenceExplanationLines: [
      "APS Q12: Amazon Registry Services, Inc. is 100% owned by Amazon.com, Inc.",
      "APS Q108 Ultimate Control: Amazon.com, Inc.",
      "Existing registry operator + Amazon registrar affiliates disclosed",
      "Applicant Website registry.amazon is corroboration only",
      "Parents/control retained separately from Organization Amazon",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-amazon-q12-ownership",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ARSI2666T-T15666/responses#Q12",
        title: "APS Q12 — Amazon Registry Services, Inc. ownership",
        summary:
          "Amazon Registry Services, Inc. is 100% owned by Amazon.com, Inc.; Affiliate of AWS Registry LLC (owned via AWSHC by Amazon.com, Inc.) and Amazon registrars.",
        supportsClaim: "Applicant is wholly owned by Amazon.com, Inc.",
        limitations: "First-party APS disclosure; steward verifies continuity",
      }),
      ev({
        evidenceId: "ev-t1a-amazon-q108",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ARSI2666T-T15666/responses#Q108",
        title: "APS Q108 Ultimate Control — Amazon Registry Services, Inc.",
        summary: "Ultimate Control disclosed as Amazon.com, Inc.",
        supportsClaim: "Ultimate control is Amazon.com, Inc. (stored separately)",
        limitations: "Control disclosure is relationship fact, not a product-brand Organization",
      }),
      ev({
        evidenceId: "ev-t1a-amazon-website",
        strength: "C",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ARSI2666T-T15666/summary",
        title: "APS Applicant Website — registry.amazon",
        summary: "Applicant Website https://www.registry.amazon/",
        supportsClaim: "Corroborates Amazon Registry public presence",
        limitations: "Website alone never confirms Organization",
      }),
      ev({
        evidenceId: "ev-t1a-amazon-brand",
        strength: "C",
        sourceType: "aps-publication",
        sourceIdentifier: "aps-applications-2.0.0:ARSI2666T-T15666:designations.brand",
        title: "APS Brand designation — Amazon Registry Services, Inc.",
        summary: "8 of 8 represented Applications are Brand-designated.",
        supportsClaim: "Brand designation corroborates brand/corporate string applications",
        limitations: "Brand designation alone never confirms Organization",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

add(
  base("ALIBABA INNOVATION PRIVATE LIMITED", {
    candidateOrganizationKey: "alibaba-group",
    candidateCanonicalName: "Alibaba Group",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS discloses Alibaba Group Holding Limited as QPE/ultimate control with affiliate RSP under common control — reuse existing canonical Organization alibaba-group.",
    requiredStewardAction:
      "APPROVE Confirmed · Alibaba Group mapping for ALIBABA INNOVATION PRIVATE LIMITED or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: "Hanbao Investment Holding Limited",
    ultimateParentLegalName: "Alibaba Group Holding Limited",
    ultimateControlLegalName: "Alibaba Group Holding Limited",
    evidenceExplanationLines: [
      "APS Q12: Alibaba Group Holding Limited is direct/QPE for Alibaba ICANN contractual family",
      "APS Q14: Alibaba Cloud RSP affiliate under common control of Alibaba Group Holding Limited",
      "APS Q108 Ultimate Control: Alibaba Group Holding Limited",
      "Reuse canonical Organization key alibaba-group",
      "Direct parent Hanbao Investment Holding Limited stored separately",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-aip-q12",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/AIPL2696T-T43947/responses#Q12",
        title: "APS Q12 — ALIBABA INNOVATION PRIVATE LIMITED QPE family",
        summary:
          "Alibaba Group Holding Limited is the direct or Qualified Parent Entity (QPE) for listed Alibaba registry operator and registrar relationships.",
        supportsClaim: "Applicant sits in Alibaba Group Holding Limited QPE/control family",
        limitations: "Steward confirms Organization boundary as Alibaba Group",
      }),
      ev({
        evidenceId: "ev-t1a-aip-q14",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/AIPL2696T-T43947/responses#Q14",
        title: "APS Q14 — Alibaba Cloud RSP affiliate",
        summary:
          "Alibaba Cloud (Beijing) Technology Co., Ltd. RSP is an Affiliate under common control of Alibaba Group Holding Limited.",
        supportsClaim: "Common-control affiliate disclosure supports Alibaba Group operating family",
        limitations: "Not selected-RSP inference; RSP affiliate ≠ Organization alone",
      }),
      ev({
        evidenceId: "ev-t1a-aip-q108",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/AIPL2696T-T43947/responses#Q108",
        title: "APS Q108 Ultimate Control — ALIBABA INNOVATION PRIVATE LIMITED",
        summary: "Ultimate Control: Alibaba Group Holding Limited.",
        supportsClaim: "Ultimate control is Alibaba Group Holding Limited",
        limitations: "Stored separately from Organization identity",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

add(
  base("Industria de Diseño Textil S.A.", {
    candidateOrganizationKey: "inditex",
    candidateCanonicalName: "Inditex",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS Q12 explicitly identifies Applicant as also known as INDITEX, S.A., existing registry operator of .Zara; Applicant Website inditex.com.",
    requiredStewardAction: "APPROVE Confirmed · Inditex or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: null,
    ultimateParentLegalName: null,
    ultimateControlLegalName: null,
    evidenceExplanationLines: [
      "APS Q12: Industria de Diseño Textil, S.A. (also known as INDITEX, S.A.) own and operate .Zara",
      "Applicant Website: inditex.com",
      "Brand Applications (e.g. Oysho) remain Applications — not Organizations",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-inditex-q12",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ITX2621T-T22327/responses#Q12",
        title: "APS Q12 — Inditex aka / existing RO",
        summary:
          "Industria de Diseño Textil, S.A. (also known as INDITEX, S.A.) own and operate the .Zara TLD.",
        supportsClaim: "Applicant self-identifies as INDITEX, S.A. and existing registry operator",
        limitations: "Aka statement is first-party APS identity evidence",
      }),
      ev({
        evidenceId: "ev-t1a-inditex-website",
        strength: "C",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ITX2621T-T22327/summary",
        title: "APS Applicant Website — inditex.com",
        summary: "Applicant Website https://www.inditex.com",
        supportsClaim: "Corroborates Inditex public identity",
        limitations: "Website alone never confirms",
      }),
      ev({
        evidenceId: "ev-t1a-inditex-brand",
        strength: "C",
        sourceType: "aps-publication",
        sourceIdentifier: "aps-applications-2.0.0:ITX2621T-T22327:designations.brand",
        title: "APS Brand designation — Industria de Diseño Textil S.A.",
        summary: "6 of 6 represented Applications are Brand-designated.",
        supportsClaim: "Brand corroboration only",
        limitations: "Brand alone never confirms; product brands are not Organizations",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

add(
  base("AT&T Services, Inc.", {
    candidateOrganizationKey: "att",
    candidateCanonicalName: "AT&T",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS Q26/Q36/Q108 disclose AT&T Inc. as parent/ultimate control for Applicant AT&T Services, Inc.; Brand .ATT applications under Applicant. Organization AT&T; parent AT&T Inc. stored separately.",
    requiredStewardAction: "APPROVE Confirmed · AT&T or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: "AT&T Inc.",
    ultimateParentLegalName: "AT&T Inc.",
    ultimateControlLegalName: "AT&T Inc.",
    evidenceExplanationLines: [
      "APS Q26/Q36 parent legal name: AT&T Inc.",
      "APS Q108 Ultimate Control: AT&T Inc.",
      "Applicant Website: att.com (corroboration)",
      "Brand .ATT Applications remain under Applicant legal name",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-att-q26",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ASI2642T-T71986/responses#Q26",
        title: "APS Q26 Direct Parent — AT&T Services, Inc.",
        summary: "Direct parent Full Legal Name: AT&T Inc. (Delaware corporation).",
        supportsClaim: "Direct parent is AT&T Inc.",
        limitations: "Parent stored separately from Organization AT&T",
      }),
      ev({
        evidenceId: "ev-t1a-att-q108",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ASI2642T-T71986/responses#Q108",
        title: "APS Q108 Ultimate Control — AT&T Services, Inc.",
        summary: "Ultimate Control: AT&T Inc.",
        supportsClaim: "Ultimate control is AT&T Inc.",
        limitations: "Control ≠ automatic Organization key",
      }),
      ev({
        evidenceId: "ev-t1a-att-website",
        strength: "C",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ASI2642T-T71986/summary",
        title: "APS Applicant Website — att.com",
        summary: "Applicant Website https://www.att.com",
        supportsClaim: "Corroborates AT&T public identity",
        limitations: "Website alone never confirms",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

add(
  base("CareCredit LLC", {
    candidateOrganizationKey: "synchrony",
    candidateCanonicalName: "Synchrony",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS Q26/Q36/Q108 disclose Synchrony Financial as parent/ultimate control; Applicant Website synchrony.com; Brand applications include .synchrony. Organization Synchrony; Applicant CareCredit preserved.",
    requiredStewardAction: "APPROVE Confirmed · Synchrony for CareCredit LLC or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: "Synchrony Financial",
    ultimateParentLegalName: "Synchrony Financial",
    ultimateControlLegalName: "Synchrony Financial",
    evidenceExplanationLines: [
      "APS Q26/Q36: Synchrony Financial",
      "APS Q108 Ultimate Control: Synchrony Financial",
      "Applicant Website: synchrony.com",
      "CareCredit remains Applicant legal name — not a separate product Organization",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-carecredit-q26",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/CL2657T-T10900/responses#Q26",
        title: "APS Q26 Parent — CareCredit LLC",
        summary: "Parent Full Legal Name: Synchrony Financial.",
        supportsClaim: "Parent/control entity is Synchrony Financial",
        limitations: "Do not invent selected-RSP or commercial opportunity claims",
      }),
      ev({
        evidenceId: "ev-t1a-carecredit-q108",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/CL2657T-T10900/responses#Q108",
        title: "APS Q108 Ultimate Control — CareCredit LLC",
        summary: "Ultimate Control: Synchrony Financial.",
        supportsClaim: "Ultimate control is Synchrony Financial",
        limitations: "Stored separately from Organization",
      }),
      ev({
        evidenceId: "ev-t1a-carecredit-website",
        strength: "C",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/CL2657T-T10900/summary",
        title: "APS Applicant Website — synchrony.com",
        summary: "Applicant Website https://www.synchrony.com/",
        supportsClaim: "Corroborates Synchrony public identity",
        limitations: "Website alone never confirms",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

add(
  base("Corporation Service Company", {
    candidateOrganizationKey: "csc",
    candidateCanonicalName: "CSC",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS Q12 states Corporation Service Company is a subsidiary of WMB Holdings Inc. and affiliate of CSC Corporate Domains registrar; Brand .CSC. Organization CSC (operating identity); parent WMB Holdings stored separately.",
    requiredStewardAction: "APPROVE Confirmed · CSC or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: "WMB Holdings, Inc.",
    ultimateParentLegalName: "WMB Holdings, Inc.",
    ultimateControlLegalName: null,
    evidenceExplanationLines: [
      "APS Q12: Corporation Service Company is a subsidiary of WMB Holdings Inc.; affiliate of CSC Corporate Domains (IANA 299)",
      "APS Q26/Q36 parent: WMB Holdings, Inc.",
      "Applicant Website: cscglobal.com (corroboration)",
      "Parent WMB Holdings retained separately from Organization CSC",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-csc-q12",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/CSC2689T-T73615/responses#Q12",
        title: "APS Q12 — Corporation Service Company subsidiary disclosure",
        summary:
          "Corporation Services Company is a subsidiary of WMB Holdings Inc, parent entity for CSC Corporate Domains, Inc. (IANA 299).",
        supportsClaim: "Applicant is a WMB Holdings subsidiary in the CSC corporate family",
        limitations: "Operating Organization labeled CSC; parent stored separately",
      }),
      ev({
        evidenceId: "ev-t1a-csc-q26",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/CSC2689T-T73615/responses#Q26",
        title: "APS Q26 Parent — Corporation Service Company",
        summary: "Parent Full Legal Name: WMB Holdings, Inc.",
        supportsClaim: "Direct parent is WMB Holdings, Inc.",
        limitations: "Parent ≠ Organization key",
      }),
      ev({
        evidenceId: "ev-t1a-csc-website",
        strength: "C",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/CSC2689T-T73615/summary",
        title: "APS Applicant Website — cscglobal.com",
        summary: "Applicant Website https://www.cscglobal.com",
        supportsClaim: "Corroborates CSC public identity",
        limitations: "Website alone never confirms",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

add(
  base("ML 35 LLC", {
    candidateOrganizationKey: "bank-of-america",
    candidateCanonicalName: "Bank of America",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS Q12 states Bank of America Corporation is the 100% indirect owner of subsidiary ML 35 LLC and Affiliate of .BOFA registry operator. Organization Bank of America; Applicant ML 35 LLC preserved; parents stored separately.",
    requiredStewardAction:
      "APPROVE Confirmed · Bank of America for ML 35 LLC or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: "Bank of America, National Association",
    ultimateParentLegalName: "Bank of America Corporation",
    ultimateControlLegalName: "Bank of America Corporation",
    evidenceExplanationLines: [
      "APS Q12: Bank of America Corporation is 100% indirect owner of ML 35 LLC",
      "APS Q26: Bank of America, National Association; Q36: Bank of America Corporation",
      "Applicant Website bankofamerica.com is corroboration only",
      "Brand Applications under ML 35 LLC remain Applicant-attributed",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-ml35-q12",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/M3L2665T-T11517/responses#Q12",
        title: "APS Q12 — ML 35 LLC ownership by Bank of America",
        summary:
          "Bank of America Corporation is the 100% indirect owner of the subsidiary ML 35 LLC; Affiliate of Bank of America Corporation registry operator for .BOFA.",
        supportsClaim: "ML 35 LLC is wholly owned (indirectly) by Bank of America Corporation",
        limitations: "Do not treat Brand strings as Organizations",
      }),
      ev({
        evidenceId: "ev-t1a-ml35-q36",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/M3L2665T-T11517/responses#Q36",
        title: "APS Q36 Ultimate Parent — ML 35 LLC",
        summary: "Ultimate parent Full Legal Name: Bank of America Corporation.",
        supportsClaim: "Ultimate parent is Bank of America Corporation",
        limitations: "Stored separately from Organization",
      }),
      ev({
        evidenceId: "ev-t1a-ml35-website",
        strength: "C",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/M3L2665T-T11517/summary",
        title: "APS Applicant Website — bankofamerica.com",
        summary: "Applicant Website https://www.bankofamerica.com",
        supportsClaim: "Corroborates Bank of America public identity",
        limitations: "Website alone never confirms",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

for (const name of [
  "Beijing Zitiao Network Technology Co., Ltd.",
  "Douyin Vision Co., Ltd.",
]) {
  const rep = byName[name].rep;
  add(
    base(name, {
      candidateOrganizationKey: "bytedance",
      candidateCanonicalName: "ByteDance",
      resolutionState: "CANDIDATE",
      reviewRecommendation: "CONFIRM",
      recommendationReason:
        "APS Q36/Q108 disclose Bytedance Ltd. as ultimate parent/control; Q26 Douyin Group (HK) Limited as intermediate parent. Organization ByteDance; Applicant legal name preserved; parents stored separately.",
      requiredStewardAction: `APPROVE Confirmed · ByteDance for ${name} or REJECT — recommendation only`,
      temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
      directParentLegalName: "Douyin Group (HK) Limited",
      ultimateParentLegalName: "Bytedance Ltd.",
      ultimateControlLegalName: "Bytedance Ltd.",
      evidenceExplanationLines: [
        "APS Q26 Direct Parent: Douyin Group (HK) Limited",
        "APS Q36/Q108: Bytedance Ltd.",
        "Affiliate registrar Beijing Volcano Engine Technology Co., Ltd. disclosed",
        "Brand product strings (Doubao / Fanqie etc.) remain Applications — not Organizations",
      ],
      evidence: [
        ev({
          evidenceId: `ev-t1a-bd-${rep}-q36`,
          strength: "B",
          sourceType: "icann-public-summary",
          sourceIdentifier: `https://newgtldprogram-aps.icann.org/aps/applications/${rep}/responses#Q36`,
          title: `APS Q36 Ultimate Parent — ${name}`,
          summary: "Ultimate parent Full Legal Name: Bytedance Ltd. (Cayman Islands).",
          supportsClaim: "Ultimate parent is Bytedance Ltd.",
          limitations: "Intermediate Douyin Group (HK) Limited retained separately",
        }),
        ev({
          evidenceId: `ev-t1a-bd-${rep}-q108`,
          strength: "B",
          sourceType: "icann-public-summary",
          sourceIdentifier: `https://newgtldprogram-aps.icann.org/aps/applications/${rep}/responses#Q108`,
          title: `APS Q108 Ultimate Control — ${name}`,
          summary: "Ultimate Control: Bytedance Ltd.",
          supportsClaim: "Ultimate control is Bytedance Ltd.",
          limitations: "Control disclosure stored separately from Organization",
        }),
        ev({
          evidenceId: `ev-t1a-bd-${rep}-q26`,
          strength: "B",
          sourceType: "icann-public-summary",
          sourceIdentifier: `https://newgtldprogram-aps.icann.org/aps/applications/${rep}/responses#Q26`,
          title: `APS Q26 Direct Parent — ${name}`,
          summary: "Direct parent Full Legal Name: Douyin Group (HK) Limited.",
          supportsClaim: "Direct parent is Douyin Group (HK) Limited",
          limitations: "Do not collapse Applicant into parent without steward approval",
        }),
      ],
      downstreamSurfacesIfApproved: surfaces,
    }),
  );
}

add(
  base("Taisho Pharmaceutical Co., Ltd.", {
    candidateOrganizationKey: "taisho",
    candidateCanonicalName: "Taisho Pharmaceutical",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS mission/purpose states Applicant is a wholly owned operating company within Taisho Pharmaceutical Holdings Co., Ltd.; Q26/Q36 list Holdings as parent. Organization Taisho Pharmaceutical; Holdings parent stored separately.",
    requiredStewardAction: "APPROVE Confirmed · Taisho Pharmaceutical or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: "Taisho Pharmaceutical Holdings Co., Ltd.",
    ultimateParentLegalName: "Taisho Pharmaceutical Holdings Co., Ltd.",
    ultimateControlLegalName: null,
    evidenceExplanationLines: [
      "APS mission text: wholly owned operating company within Taisho Pharmaceutical Holdings Co., Ltd. group",
      "APS Q26/Q36: Taisho Pharmaceutical Holdings Co., Ltd.",
      "Brand string Lipovitan remains an Application — not an Organization",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-taisho-mission-wholly-owned",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/TPCL2648T-T11392/responses#Q133",
        title: "APS Q133 — Taisho wholly-owned operating company statement",
        summary:
          "Taisho Pharmaceutical Co., Ltd. is a corporation headquartered in Tokyo, Japan, and a wholly owned operating company within the Taisho Pharmaceutical Holdings Co., Ltd. group.",
        supportsClaim:
          "Applicant is wholly owned by Taisho Pharmaceutical Holdings Co., Ltd.",
        limitations: "Operating Organization is Taisho Pharmaceutical; Holdings is parent",
      }),
      ev({
        evidenceId: "ev-t1a-taisho-q36",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/TPCL2648T-T11392/responses#Q36",
        title: "APS Q36 Parent — Taisho Pharmaceutical Co., Ltd.",
        summary: "Parent Full Legal Name: Taisho Pharmaceutical Holdings Co., Ltd.",
        supportsClaim: "Parent is Taisho Pharmaceutical Holdings Co., Ltd.",
        limitations: "Stored separately from Organization",
      }),
      ev({
        evidenceId: "ev-t1a-taisho-website",
        strength: "C",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/TPCL2648T-T11392/summary",
        title: "APS Applicant Website — taisho.co.jp",
        summary: "Applicant Website https://www.taisho.co.jp/",
        supportsClaim: "Corroborates Taisho public identity",
        limitations: "Website alone never confirms",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

add(
  base("Public Interest Registry", {
    candidateOrganizationKey: "pir",
    candidateCanonicalName: "Public Interest Registry",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS Q12: existing registry operator; Q26/Q36/Q108 Internet Society as parent/control. Organization Public Interest Registry (operating RO); Internet Society parent stored separately.",
    requiredStewardAction: "APPROVE Confirmed · Public Interest Registry or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: "Internet Society",
    ultimateParentLegalName: "Internet Society",
    ultimateControlLegalName: "Internet Society",
    evidenceExplanationLines: [
      "APS Q12: Existing Registry Operator",
      "APS Q26/Q36/Q108: Internet Society",
      "Applicant Website: pir.org",
      "Internet Society retained as parent/control — not collapsed away",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-pir-q12",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/PIR2624T-T12017/responses#Q12",
        title: "APS Q12 — Public Interest Registry existing RO",
        summary: "Existing Registry Operator.",
        supportsClaim: "Applicant is an existing registry operator (PIR)",
        limitations: "RO status alone does not invent parent collapse",
      }),
      ev({
        evidenceId: "ev-t1a-pir-q108",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/PIR2624T-T12017/responses#Q108",
        title: "APS Q108 Ultimate Control — Public Interest Registry",
        summary: "Ultimate Control: Internet Society.",
        supportsClaim: "Ultimate control is Internet Society (stored separately)",
        limitations: "Parent/control separate from operating Organization PIR",
      }),
      ev({
        evidenceId: "ev-t1a-pir-website",
        strength: "C",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/PIR2624T-T12017/summary",
        title: "APS Applicant Website — pir.org",
        summary: "Applicant Website https://pir.org/",
        supportsClaim: "Corroborates PIR public identity",
        limitations: "Website alone never confirms",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

add(
  base("Hostinger UAB", {
    candidateOrganizationKey: "hostinger",
    candidateCanonicalName: "Hostinger",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "Strict legal-name↔hostinger.com self-identity (UAB suffix stripped) plus APS Q12 Hostinger-group registrar affiliate and Hostinger investment/group parent disclosures. Organization Hostinger; parents/control stored separately.",
    requiredStewardAction: "APPROVE Confirmed · Hostinger or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: "HOSTINGER INVESTMENTS S.a r.l.",
    ultimateParentLegalName: "HOSTINGER Group International S.à r.l.",
    ultimateControlLegalName: "Arnas Stuopelis",
    evidenceExplanationLines: [
      "Legal-name stem hostinger matches registrable domain hostinger.com (strict self-identity)",
      "APS Q12: Affiliate Hostinger operations UAB is ICANN-accredited registrar",
      "APS Q26/Q36 Hostinger investment/group entities; Q108 individual ultimate control stored separately",
      "Website alone would be insufficient — paired with APS Hostinger-group identity disclosures",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-hostinger-self-identity",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/HU2684T-T32145/summary#self-identity",
        title: "APS legal-name / domain self-identity — Hostinger UAB",
        summary:
          "Applicant legal name Hostinger UAB and Applicant Website domain hostinger.com describe the same Hostinger identity after conservative suffix/domain-stem normalization.",
        supportsClaim: "Self-identity supports Organization Hostinger",
        limitations: "Matching is discovery-quality; steward approval still required",
      }),
      ev({
        evidenceId: "ev-t1a-hostinger-q12",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/HU2684T-T32145/responses#Q12",
        title: "APS Q12 — Hostinger registrar affiliate",
        summary: "Affiliate company Hostinger operations UAB is ICANN accredited registrar.",
        supportsClaim: "Applicant discloses Hostinger-group registrar affiliate relationship",
        limitations: "Affiliate ≠ automatic parent collapse",
      }),
      ev({
        evidenceId: "ev-t1a-hostinger-website",
        strength: "C",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/HU2684T-T32145/summary",
        title: "APS Applicant Website — hostinger.com",
        summary: "Applicant Website https://www.hostinger.com",
        supportsClaim: "Corroborates Hostinger public identity",
        limitations: "Website alone never confirms",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

add(
  base("Epic systems corporation", {
    candidateOrganizationKey: "epic-systems",
    candidateCanonicalName: "Epic Systems",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS mission/purpose first-party statement that Epic Systems Corporation is applying for .epic as Spec-13 brand TLD for Epic Systems Corporation and affiliates; Applicant Website epic.com corroborates. Self-organization Epic Systems.",
    requiredStewardAction: "APPROVE Confirmed · Epic Systems or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: null,
    ultimateParentLegalName: null,
    ultimateControlLegalName: null,
    evidenceExplanationLines: [
      "APS Q133: Epic Systems Corporation applying for .epic as dotBrand under Spec 13 for Epic and affiliates",
      "Applicant Website: epic.com (corroboration; stem soft-match only)",
      "Brand designation corroborates; Brand alone never confirms",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-epic-q133-self",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ESC2616T-T27738/responses#Q133",
        title: "APS Q133 — Epic Systems Corporation self brand-TLD mission",
        summary:
          "Epic Systems Corporation is applying for the .epic top-level domain as a dotBrand TLD under Specification 13 for Epic Systems Corporation and its affiliates.",
        supportsClaim: "Applicant legal entity is the operating Epic Systems brand participant",
        limitations: "Soft website match alone would be insufficient; APS self statement is primary B",
      }),
      ev({
        evidenceId: "ev-t1a-epic-website",
        strength: "C",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ESC2616T-T27738/summary",
        title: "APS Applicant Website — epic.com",
        summary: "Applicant Website https://www.epic.com/",
        supportsClaim: "Corroborates Epic public identity",
        limitations: "Website alone never confirms",
      }),
      ev({
        evidenceId: "ev-t1a-epic-brand",
        strength: "C",
        sourceType: "aps-publication",
        sourceIdentifier: "aps-applications-2.0.0:ESC2616T-T27738:designations.brand",
        title: "APS Brand designation — Epic systems corporation",
        summary: "2 of 2 represented Applications are Brand-designated.",
        supportsClaim: "Brand corroboration only",
        limitations: "Brand alone never confirms",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

add(
  base("Innovation Service Limited", {
    candidateOrganizationKey: "innovation-service",
    candidateCanonicalName: "Innovation Service Limited",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS Q12: Innovation Service Limited is the registry operator of the .HELP gTLD — self-resolution as existing RO under exact Applicant legal name.",
    requiredStewardAction:
      "APPROVE Confirmed · Innovation Service Limited (self) or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: null,
    ultimateParentLegalName: null,
    ultimateControlLegalName: "Heng Lu",
    evidenceExplanationLines: [
      "APS Q12: Innovation Service Limited is the registry operator of the .HELP gTLD",
      "Ultimate control individual Heng Lu stored separately — not an Organization",
      "Applicant Website nic.help is corroboration only",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-isl-q12",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ISL2626T-T27355/responses#Q12",
        title: "APS Q12 — Innovation Service Limited existing RO .HELP",
        summary: "Innovation Service Limited is the registry operator of the .HELP gTLD.",
        supportsClaim: "Applicant legal name is the existing registry operator entity",
        limitations: "Self-organization only; individual ultimate control not an Organization",
      }),
      ev({
        evidenceId: "ev-t1a-isl-website",
        strength: "C",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/ISL2626T-T27355/summary",
        title: "APS Applicant Website — nic.help",
        summary: "Applicant Website https://nic.help",
        supportsClaim: "Corroborates .HELP operator presence",
        limitations: "Website alone never confirms",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

add(
  base("Internet DotTrademark Organisation Limited", {
    candidateOrganizationKey: "internet-dottrademark",
    candidateCanonicalName: "Internet DotTrademark Organisation",
    resolutionState: "CANDIDATE",
    reviewRecommendation: "CONFIRM",
    recommendationReason:
      "APS Q12: existing registry operator for IDN TLDs; Q26/Q36 disclose DotTrademark Holding entities as parents. Organization is Applicant operating identity; holdings parents stored separately.",
    requiredStewardAction:
      "APPROVE Confirmed · Internet DotTrademark Organisation or REJECT — recommendation only",
    temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
    directParentLegalName: "DotTrademark Holding Limited",
    ultimateParentLegalName: "DotTrademark Holding Group",
    ultimateControlLegalName: "Xiongwei Huang",
    evidenceExplanationLines: [
      "APS Q12: existing registry operator for .xn--czr694b and .xn--imr513n",
      "APS Q26/Q36: DotTrademark Holding Limited / DotTrademark Holding Group",
      "Ultimate control individual stored separately",
    ],
    evidence: [
      ev({
        evidenceId: "ev-t1a-idol-q12",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/IDOL2621T-T12142/responses#Q12",
        title: "APS Q12 — Internet DotTrademark existing RO",
        summary:
          "The applying entity is an existing registry operator for the TLDs .xn--czr694b and .xn--imr513n; related to ShangYu Global Technology Co., Ltd. under common control language.",
        supportsClaim: "Applicant is an existing registry operator under this legal name",
        limitations: "Holding parents stored separately; do not invent ShangYu Organization without clearer ownership",
      }),
      ev({
        evidenceId: "ev-t1a-idol-q26",
        strength: "B",
        sourceType: "icann-public-summary",
        sourceIdentifier:
          "https://newgtldprogram-aps.icann.org/aps/applications/IDOL2621T-T12142/responses#Q26",
        title: "APS Q26 Parent — Internet DotTrademark Organisation Limited",
        summary: "Parent Full Legal Name: DotTrademark Holding Limited.",
        supportsClaim: "Direct parent is DotTrademark Holding Limited",
        limitations: "Parent stored separately from Organization",
      }),
    ],
    downstreamSurfacesIfApproved: surfaces,
  }),
);

// ——— KEEP_CANDIDATE ———
const keep = [
  [
    "Axon Enterprise, Inc.",
    "axon",
    "Axon",
    "Brand .AXON + axon.com soft website match without strict legal-name↔domain self-identity and without A/B ownership/parent disclosure. Plausible self-Organization Axon; confirmation threshold not met.",
    "Leave CANDIDATE pending stricter self-identity or ownership/control A/B evidence",
  ],
  [
    "American Lebanese Syrian Associated Charities, Inc.",
    "alsac",
    "ALSAC",
    "Brand .STJUDE + stjude.org website without ALSAC↔domain self-identity; ultimate control listed as individuals. Do not auto-collapse to St. Jude Children's Research Hospital. Plausible ALSAC Organization; confirmation threshold not met.",
    "Leave CANDIDATE; do not CONFIRM St. Jude Hospital from fundraising website alone",
  ],
  [
    "Canadian Imperial Bank of Commerce",
    "cibc",
    "CIBC",
    "Applicant appears to be the chartered bank with cibc.com website, but legal-name stem does not strictly match domain stem and no A/B ownership filing was packaged in this tranche.",
    "Leave CANDIDATE pending SEC/regulatory A evidence or accepted self-identity standard clearance",
  ],
  [
    "Dine Brands Global, Inc.",
    "dine-brands",
    "Dine Brands Global",
    "Brand applications + dinebrands.com soft match without strict self-identity and without parent ownership A/B disclosure.",
    "Leave CANDIDATE pending stricter identity evidence",
  ],
  [
    "Endpoint Domains, Inc.",
    "endpoint-domains",
    "Endpoint Domains",
    "Strict endpointdomains.com self-identity website match only — Applicant Website alone never confirms; no Brand; no ownership A/B beyond individual ultimate control name.",
    "Leave CANDIDATE; do not CONFIRM from website alone",
  ],
  [
    "Cam Connecting SARL",
    "cam-connecting",
    "Cam Connecting",
    "APS affiliate of AC WEBCONNECTING NV / domain.cam without explicit ownership/control language establishing a single Organization boundary.",
    "Leave CANDIDATE pending ownership/control evidence",
  ],
  [
    "NETDREAM PTE. LTD.",
    null,
    null,
    "Affiliate of Hong Kong Zhongze International Limited disclosed; Applicant Website is example.com (unusable); Organization boundary unclear.",
    "Leave unresolved/candidate pending usable identity evidence",
  ],
  [
    "TechEdge Limited",
    null,
    null,
    "APS discusses July Name Limited registrar and Hong Kong Juming Network Technology Co. relationships without a clear wholly-owned/parent statement for TechEdge Limited itself.",
    "Leave CANDIDATE pending explicit ownership/control evidence",
  ],
];

for (const [name, key, canon, reason, action] of keep) {
  const o = byName[name];
  add(
    base(name, {
      candidateOrganizationKey: key,
      candidateCanonicalName: canon,
      resolutionState: key ? "CANDIDATE" : "UNRESOLVED",
      reviewRecommendation: "KEEP_CANDIDATE",
      recommendationReason: reason,
      requiredStewardAction: action,
      temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
      directParentLegalName: null,
      ultimateParentLegalName: null,
      ultimateControlLegalName: null,
      evidenceExplanationLines: [
        `Applicant Website: ${o.host ?? "(none)"}`,
        "No A/B ownership/self-identity package meeting CONFIRM threshold in this tranche",
      ],
      evidence: [
        ev({
          evidenceId: `ev-t1a-keep-${o.rep}-website`,
          strength: "C",
          sourceType: "icann-public-summary",
          sourceIdentifier: `https://newgtldprogram-aps.icann.org/aps/applications/${o.rep}/summary`,
          title: `APS Applicant Website — ${name}`,
          summary: `Applicant Website recorded as ${o.url ?? o.host ?? "n/a"}`,
          supportsClaim: "Website/discovery corroboration only",
          limitations: "Website alone never confirms; C-only cannot CONFIRM",
        }),
      ],
      downstreamSurfacesIfApproved: [],
    }),
  );
}

// ——— MARK_AMBIGUOUS ———
const ambiguous = [
  [
    "NAME SPACE LLC",
    "APS common-control disclosures span Hello Internet Corp, CCI REG, .CO consortium member, Reinvent Internet LLC, Cuatro Efe Foundation, and repeated individual ultimate-control names — Organization portfolio boundary unclear.",
  ],
  [
    "Registered Agents Inc",
    "APS places Applicant in Corporate Tools group with Epik/Domain Registry/Anonymize affiliates and Bonanzitizing LLC parent/control — operating Organization vs holding/group identity is ambiguous.",
  ],
];

for (const [name, reason] of ambiguous) {
  const o = byName[name];
  add(
    base(name, {
      candidateOrganizationKey: null,
      candidateCanonicalName: null,
      resolutionState: "AMBIGUOUS",
      reviewRecommendation: "MARK_AMBIGUOUS",
      recommendationReason: reason,
      requiredStewardAction: "Do not CONFIRM until Organization boundary is clarified with ownership/control evidence",
      temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
      directParentLegalName: null,
      ultimateParentLegalName: null,
      ultimateControlLegalName: null,
      evidenceExplanationLines: [
        "Multiple plausible Organization interpretations from affiliate/common-control disclosures",
        "Affiliate/RSP/registrar relationships must not be treated as Organization identity",
      ],
      evidence: [
        ev({
          evidenceId: `ev-t1a-amb-${o.rep}-q12`,
          strength: "C",
          sourceType: "icann-public-summary",
          sourceIdentifier: `https://newgtldprogram-aps.icann.org/aps/applications/${o.rep}/responses#Q12`,
          title: `APS Q12 affiliate/common-control — ${name}`,
          summary: reason,
          supportsClaim: "Affiliate/common-control signals exist but Organization boundary is unclear",
          limitations: "C-quality; cannot CONFIRM",
        }),
      ],
      downstreamSurfacesIfApproved: [],
    }),
  );
}

// ——— NO_EVIDENCE ———
for (const name of ["Suffix Inc.", "NextGEN TLDs GmbH"]) {
  const o = byName[name];
  add(
    base(name, {
      candidateOrganizationKey: null,
      candidateCanonicalName: null,
      resolutionState: "UNRESOLVED",
      reviewRecommendation: "NO_EVIDENCE",
      recommendationReason:
        name === "Suffix Inc."
          ? "Website suffix.domains provides at most website self-identity corroboration; no Brand; Q11 false; no A/B ownership/control disclosure. Website alone never confirms."
          : "Applicant Website nowebsite.de; Q11 false; ultimate control individuals only; no A/B ownership/self-operator identity establishing an Organization beyond the legal name.",
      requiredStewardAction: "Leave UNRESOLVED or research further with A/B sources",
      temporalNote: "APS Reveal Day 2026-10-07; retrieved 2026-10-13",
      directParentLegalName: null,
      ultimateParentLegalName: null,
      ultimateControlLegalName: null,
      evidenceExplanationLines: [
        `Applicant Website: ${o.host}`,
        "No qualifying A/B identity/ownership evidence packaged",
      ],
      evidence: [],
      downstreamSurfacesIfApproved: [],
    }),
  );
}

// Strip non-schema extras for identity package (keep lane metadata in parallel queue file)
const identityDossiers = research.map((d) => {
  const {
    applicationCount,
    brandApplicationCount,
    officialContentionMembershipCount,
    distinctContentionSetCount,
    representativeApplicationIds,
    lanes,
    priorResolutionState,
    downstreamSurfacesIfApproved,
    potentialPublicMainRspMatch,
    crossRoundIdentityCreated,
    ...identity
  } = d;
  return identity;
});

const pkg = {
  packageVersion: "applicant-identity-evidence-package/1.0.0",
  methodNote:
    "ORG-RES-TRANCHE-1A bounded Brand + multi-Application UNRESOLVED research queue. Recommendations only — never steward APPROVE / never product CONFIRMED. Brand designation and website alone never CONFIRM. D/C-only never CONFIRM. No cross-round identity. No selected-RSP claims.",
  researchedAt: RETRIEVED,
  decisionId: "RIH-ORG-RES-TRANCHE-1A-20261013",
  stewardApprovalGranted: false,
  productEligibleConfirmedMappings: 0,
  dossiers: identityDossiers,
};

const queue = {
  schemaVersion: "org-res-tranche-queue/1.0.0",
  decisionId: "RIH-ORG-RES-TRANCHE-1A-20261013",
  selection: {
    brandLaneRule:
      "UNRESOLVED with brand>=1; top 15 by brand desc, apps desc, contention memberships desc, name asc",
    multiLaneRule:
      "UNRESOLVED with apps>=2; top 15 by apps desc, brand desc, contention memberships desc, name asc",
    maxDossiers: 30,
  },
  dossiers: research.map((d) => ({
    applicantLegalName: d.applicantLegalName,
    lanes: d.lanes,
    applicationCount: d.applicationCount,
    brandApplicationCount: d.brandApplicationCount,
    officialContentionMembershipCount: d.officialContentionMembershipCount,
    distinctContentionSetCount: d.distinctContentionSetCount,
    representativeApplicationIds: d.representativeApplicationIds,
    priorResolutionState: d.priorResolutionState,
    reviewRecommendation: d.reviewRecommendation,
    candidateOrganizationKey: d.candidateOrganizationKey,
    candidateCanonicalName: d.candidateCanonicalName,
    downstreamSurfacesIfApproved: d.downstreamSurfacesIfApproved,
  })),
};

const outDir = path.join(root, "src/organization-resolution-2026/fixtures");
writeFileSync(
  path.join(outDir, "applicant-identity-evidence-package-tranche1a.json"),
  `${JSON.stringify(pkg, null, 2)}\n`,
);
writeFileSync(
  path.join(outDir, "org-res-tranche-1a-queue.json"),
  `${JSON.stringify(queue, null, 2)}\n`,
);

const confirms = research.filter((d) => d.reviewRecommendation === "CONFIRM");
console.log(
  JSON.stringify(
    {
      dossiers: research.length,
      confirm: confirms.length,
      keep: research.filter((d) => d.reviewRecommendation === "KEEP_CANDIDATE").length,
      ambiguous: research.filter((d) => d.reviewRecommendation === "MARK_AMBIGUOUS").length,
      none: research.filter((d) => d.reviewRecommendation === "NO_EVIDENCE").length,
      reject: research.filter((d) => d.reviewRecommendation === "REJECT_RELATIONSHIP").length,
      confirmNames: confirms.map((d) => d.applicantLegalName),
      orgKeys: [...new Set(confirms.map((d) => d.candidateOrganizationKey))],
    },
    null,
    2,
  ),
);
