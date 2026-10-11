/**
 * Read-only APS Application detail acquisition (ORG-RES-WEB-1).
 * Summary: organizationWebsite. Responses: Q10/Q11/Q12/Q14/Q19/Q26/Q36/Q108.
 */

export const APS_FRONTEND_ORIGIN = "https://newgtldprogram-aps.icann.org";
export const APS_CONFIG_URL = `${APS_FRONTEND_ORIGIN}/api/config`;
export const APS_DETAIL_EXTRACTOR_VERSION = "aps-application-detail/1.0.0";

export const IDENTITY_QUESTION_IDS = [
  "Q10",
  "Q11",
  "Q12",
  "Q13",
  "Q14",
  "Q19",
  "Q26",
  "Q36",
  "Q108",
] as const;

export type IdentityQuestionId = (typeof IDENTITY_QUESTION_IDS)[number];

export type ApsApplicationSummary = {
  applicationHumanReadableId: string;
  applicationDetails?: {
    lastPublishedAt?: string;
    primaryString?: { aLabel?: string; uLabel?: string };
  };
  applicantDetails?: {
    organizationName?: string;
    organizationWebsite?: string | null;
    organizationCountryCode?: string;
    icannRegion?: string;
  };
};

export type ApsIdentityField = {
  questionId: IdentityQuestionId;
  questionText: string;
  responseText: string;
  sectionTitle: string;
};

export type ApsIdentityExtraction = {
  applicationId: string;
  fields: Partial<Record<IdentityQuestionId, ApsIdentityField>>;
  extractorVersion: typeof APS_DETAIL_EXTRACTOR_VERSION;
};

const Q_RE = /\bQ(\d+)\b/i;
const Q108_RE = /\b108\b/;

function questionIdFromText(text: string): IdentityQuestionId | null {
  const m = text.match(Q_RE);
  if (m) {
    const id = `Q${m[1]}` as IdentityQuestionId;
    if ((IDENTITY_QUESTION_IDS as readonly string[]).includes(id)) return id;
  }
  if (/ultimate control/i.test(text) || (Q108_RE.test(text) && /disclose/i.test(text))) {
    return "Q108";
  }
  return null;
}

export function summarySourceUrl(applicationId: string, restBackendUrl: string): string {
  return `${restBackendUrl.replace(/\/$/, "")}/applications/${encodeURIComponent(applicationId)}/summary`;
}

export function responsesSourceUrl(applicationId: string, restBackendUrl: string): string {
  return `${restBackendUrl.replace(/\/$/, "")}/applications/${encodeURIComponent(applicationId)}/responses`;
}

export function applicationPageUrl(applicationId: string): string {
  return `${APS_FRONTEND_ORIGIN}/applications/${encodeURIComponent(applicationId)}`;
}

export function extractOrganizationWebsite(summary: ApsApplicationSummary): string | null {
  const raw = summary.applicantDetails?.organizationWebsite;
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

type ResponsesBody = {
  questionAndResponses?: {
    sections?: Array<{
      sectionTitle?: string;
      questions?: Array<{ questionText?: string; responseText?: string | null }>;
    }>;
  };
};

export function extractIdentityFieldsFromResponses(
  applicationId: string,
  body: ResponsesBody,
): ApsIdentityExtraction {
  const fields: Partial<Record<IdentityQuestionId, ApsIdentityField>> = {};
  for (const section of body.questionAndResponses?.sections ?? []) {
    for (const q of section.questions ?? []) {
      const questionText = q.questionText ?? "";
      const id = questionIdFromText(questionText);
      if (!id || fields[id]) continue;
      fields[id] = {
        questionId: id,
        questionText,
        responseText: (q.responseText ?? "").trim(),
        sectionTitle: section.sectionTitle ?? "",
      };
    }
  }
  return {
    applicationId,
    fields,
    extractorVersion: APS_DETAIL_EXTRACTOR_VERSION,
  };
}

export function emailDomainFromBusinessEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

export function truthyResponse(value: string | null | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1";
}
