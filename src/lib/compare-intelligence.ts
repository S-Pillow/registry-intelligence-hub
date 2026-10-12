/**
 * COMPARE-INTEL-2 — Applicant and Confirmed Organization comparison.
 * Reuses applicant / organization intelligence. Homogeneous grain only.
 */

import type { EvaluatedMainRspArtifact } from "@/lib/icann-evaluated-rsp";
import {
  buildApplicantIntelligenceProfile,
  type ApplicantIntelligenceLookup,
  type ApplicantIntelligenceProfile,
} from "@/lib/applicant-intelligence";
import {
  buildOrganizationIntelligenceProfile,
  type OrganizationIntelligenceLookup,
  type OrganizationIntelligenceProfile,
} from "@/lib/organization-intelligence";
import type { ParticipantOverlays } from "@/lib/participant-intelligence";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import type { OrganizationResolutionSnapshot } from "@/organization-resolution-2026/types";

export const COMPARE_INTEL_ENTITY_TYPES = ["applicant", "organization"] as const;
export type CompareIntelEntityType = (typeof COMPARE_INTEL_ENTITY_TYPES)[number];

export const COMPARE_INTEL_MAX = 4;
export const COMPARE_INTEL_IDS_SEPARATOR = "|";

export type CompareMetricValue =
  | { kind: "number"; value: number }
  | { kind: "text"; value: string }
  | { kind: "unavailable"; label?: string };

export type CompareMetricRow = {
  id: string;
  label: string;
  values: CompareMetricValue[];
  /** When true, highlight differing numeric values across columns. */
  emphasizeDifference?: boolean;
  note?: string;
};

export type CompareSection = {
  id: string;
  title: string;
  rows: CompareMetricRow[];
};

export type CompareIntelColumn =
  | {
      grain: "applicant";
      key: string;
      label: string;
      profileHref: string;
      lookup: ApplicantIntelligenceLookup;
    }
  | {
      grain: "organization";
      key: string;
      label: string;
      profileHref: string;
      lookup: OrganizationIntelligenceLookup;
    };

export type CompareIntelViewModel = {
  grain: CompareIntelEntityType;
  title: string;
  subtitle: string;
  columns: CompareIntelColumn[];
  sections: CompareSection[];
  shareHref: string;
  contentionHref: string | null;
  emptyReason?: string;
  warnings: string[];
};

export function isCompareIntelEntityType(value: string | null | undefined): value is CompareIntelEntityType {
  return value === "applicant" || value === "organization";
}

/** Encode shareable ids — encodeURIComponent each key, join with `|` (safe for commas in legal names). */
export function encodeCompareIntelIds(ids: readonly string[]): string {
  return ids.map((id) => encodeURIComponent(id.trim())).filter(Boolean).join(COMPARE_INTEL_IDS_SEPARATOR);
}

export function decodeCompareIntelIds(raw: string | null | undefined): string[] {
  if (raw == null || !raw.trim()) return [];
  return raw
    .split(COMPARE_INTEL_IDS_SEPARATOR)
    .map((part) => {
      try {
        return decodeURIComponent(part.trim());
      } catch {
        return part.trim();
      }
    })
    .filter(Boolean);
}

export function compareIntelHref(
  grain: CompareIntelEntityType,
  ids: readonly string[],
  origin?: string,
): string {
  const params = new URLSearchParams();
  params.set("type", grain);
  params.set("ids", encodeCompareIntelIds(ids));
  if (origin) params.set("origin", origin);
  return `/compare?${params.toString()}`;
}

function num(value: number): CompareMetricValue {
  return { kind: "number", value };
}

function text(value: string): CompareMetricValue {
  return { kind: "text", value };
}

function unavailable(label = "Not available"): CompareMetricValue {
  return { kind: "unavailable", label };
}

function stringsPreview(labels: string[], limit = 6): string {
  if (labels.length === 0) return "Not available";
  const head = labels.slice(0, limit);
  const more = labels.length - head.length;
  return more > 0 ? `${head.join(", ")} (+${more} more)` : head.join(", ");
}

function applicantOrgField(profile: ApplicantIntelligenceProfile): CompareMetricValue {
  if (profile.organizationResolutionStatus === "CONFIRMED" && profile.confirmedOrganizationName) {
    return text(`Confirmed · ${profile.confirmedOrganizationName}`);
  }
  if (profile.organizationResolutionStatus === "CANDIDATE") {
    return text("Candidate (not confirmed)");
  }
  if (profile.organizationResolutionStatus === "AMBIGUOUS") {
    return text("Ambiguous (not confirmed)");
  }
  return text("Not resolved");
}

function applicantHistorical(profile: ApplicantIntelligenceProfile): {
  apps2012: CompareMetricValue;
  apps2026: CompareMetricValue;
  delta: CompareMetricValue;
  note: string;
} {
  const ret = profile.confirmedReturning;
  if (!ret) {
    return {
      apps2012: unavailable("No confirmed cross-round Organization relationship"),
      apps2026: unavailable("No confirmed cross-round Organization relationship"),
      delta: unavailable("No confirmed cross-round Organization relationship"),
      note: "Historical Organization totals appear only for steward-confirmed cross-round relationships. Unmatched ≠ new.",
    };
  }
  return {
    apps2012: num(ret.applications2012),
    apps2026: num(ret.applications2026),
    delta: num(ret.applicationDelta),
    note: "Confirmed Organization continuity context — does not claim identical Applicant legal-entity wording across rounds.",
  };
}

function organizationHistorical(profile: OrganizationIntelligenceProfile): {
  apps2012: CompareMetricValue;
  apps2026: CompareMetricValue;
  delta: CompareMetricValue;
  note: string;
} {
  const ret = profile.confirmedReturning;
  if (!ret) {
    return {
      apps2012: unavailable("No confirmed cross-round Organization relationship"),
      apps2026: unavailable("No confirmed cross-round Organization relationship"),
      delta: unavailable("No confirmed cross-round Organization relationship"),
      note: "Do not display 2012 = 0 when identity has simply not been confirmed. Unmatched ≠ new.",
    };
  }
  return {
    apps2012: num(ret.applications2012),
    apps2026: num(ret.applications2026),
    delta: num(ret.applicationDelta),
    note: "Confirmed cross-round Organization relationship — absolute Application delta only.",
  };
}

function organizationRspSummary(profile: OrganizationIntelligenceProfile): CompareMetricValue {
  const r = profile.rspAmongMappedApplicants;
  const parts = [
    `${r.publicMainRspCapableCount} public Main-RSP capability found`,
    `${r.noPublicMainRspCount} no public Main-RSP capability found`,
  ];
  if (r.viaConfirmedOrganizationCount > 0) {
    parts.push(`${r.viaConfirmedOrganizationCount} via confirmed Organization`);
  }
  if (r.identityReviewCount > 0) {
    parts.push(`${r.identityReviewCount} identity review needed`);
  }
  return text(parts.join(" · "));
}

function buildApplicantSections(profiles: ApplicantIntelligenceProfile[]): CompareSection[] {
  const hist = profiles.map(applicantHistorical);
  return [
    {
      id: "identity",
      title: "Identity",
      rows: [
        {
          id: "legal-name",
          label: "Applicant legal name",
          values: profiles.map((p) => text(p.applicantLegalName)),
        },
        {
          id: "country-region",
          label: "Country / region",
          values: profiles.map((p) => {
            const c = p.countries.join(", ") || null;
            const r = p.regions.join(", ") || null;
            if (!c && !r) return unavailable();
            return text([c, r].filter(Boolean).join(" · "));
          }),
        },
        {
          id: "confirmed-org",
          label: "Confirmed Organization",
          values: profiles.map(applicantOrgField),
        },
        {
          id: "website",
          label: "Applicant Website",
          values: profiles.map((p) =>
            p.identityEvidence?.applicantWebsiteHost
              ? text(p.identityEvidence.applicantWebsiteHost)
              : unavailable(),
          ),
        },
      ],
    },
    {
      id: "portfolio",
      title: "Portfolio",
      rows: [
        {
          id: "applications",
          label: "Applications",
          values: profiles.map((p) => num(p.applicationCount)),
          emphasizeDifference: true,
        },
        {
          id: "brand",
          label: "Brand Applications",
          values: profiles.map((p) => num(p.brandApplicationCount)),
          emphasizeDifference: true,
        },
        {
          id: "brand-share",
          label: "Brand share",
          values: profiles.map((p) =>
            p.applicationCount > 0
              ? text(`${p.brandApplicationCount} of ${p.applicationCount}`)
              : unavailable(),
          ),
        },
        {
          id: "strings",
          label: "Applied strings preview",
          values: profiles.map((p) =>
            text(stringsPreview(p.portfolio.map((row) => row.appliedForString).filter(Boolean))),
          ),
        },
      ],
    },
    {
      id: "brand-section",
      title: "Brand",
      rows: [
        {
          id: "brand-count",
          label: "Brand Applications",
          values: profiles.map((p) => num(p.brandApplicationCount)),
          emphasizeDifference: true,
        },
        {
          id: "brand-of",
          label: "Brand of Applications",
          values: profiles.map((p) =>
            p.applicationCount > 0
              ? text(`${p.brandApplicationCount} of ${p.applicationCount}`)
              : unavailable(),
          ),
        },
      ],
    },
    {
      id: "contention",
      title: "Contention",
      rows: [
        {
          id: "contested-apps",
          label: "Applications in official initial contention",
          values: profiles.map((p) => num(p.contestedApplicationCount)),
          emphasizeDifference: true,
          note: "Application memberships — not interchangeable with set counts or Applicant counts.",
        },
        {
          id: "unique-sets",
          label: "Unique contention sets",
          values: profiles.map((p) => num(p.uniqueContentionSets)),
          emphasizeDifference: true,
        },
        {
          id: "counterparts",
          label: "Distinct counterpart Applicants",
          values: profiles.map((p) => num(p.distinctCounterpartApplicants)),
          emphasizeDifference: true,
        },
      ],
    },
    {
      id: "rsp",
      title: "RSP",
      rows: [
        {
          id: "rsp-posture",
          label: "Public Main-RSP posture",
          values: profiles.map((p) => text(p.rspPostureLabel)),
          note: "Selected RSP is not established by public Applicant data.",
        },
      ],
    },
    {
      id: "historical",
      title: "Historical participation",
      rows: [
        {
          id: "hist-2012",
          label: "2012 Applications (confirmed Organization)",
          values: hist.map((h) => h.apps2012),
          emphasizeDifference: true,
        },
        {
          id: "hist-2026",
          label: "2026 Applications (confirmed Organization)",
          values: hist.map((h) => h.apps2026),
          emphasizeDifference: true,
        },
        {
          id: "hist-delta",
          label: "Absolute delta",
          values: hist.map((h) => h.delta),
          emphasizeDifference: true,
          note: hist[0]?.note,
        },
      ],
    },
    {
      id: "evidence",
      title: "Evidence / confidence",
      rows: [
        {
          id: "org-status",
          label: "Organization mapping state",
          values: profiles.map((p) => text(p.organizationResolutionStatus)),
        },
        {
          id: "returning-context",
          label: "Returning Organization context",
          values: profiles.map((p) =>
            p.confirmedReturning
              ? text("Confirmed Organization returning sample context")
              : unavailable("No confirmed cross-round Organization relationship"),
          ),
        },
      ],
    },
  ];
}

function buildOrganizationSections(profiles: OrganizationIntelligenceProfile[]): CompareSection[] {
  const hist = profiles.map(organizationHistorical);
  return [
    {
      id: "identity",
      title: "Identity",
      rows: [
        {
          id: "canonical-name",
          label: "Organization canonical name",
          values: profiles.map((p) => text(p.canonicalName)),
        },
        {
          id: "mapped-applicants",
          label: "Mapped Applicant legal entities",
          values: profiles.map((p) => num(p.applicantEntityCount)),
          emphasizeDifference: true,
          note: "Applications belong to legal Applicants — Organization aggregates do not replace Applicant attribution.",
        },
        {
          id: "applicant-names-preview",
          label: "Applicant entities preview",
          values: profiles.map((p) =>
            text(stringsPreview(p.applicants.map((a) => a.applicantLegalName), 5)),
          ),
        },
      ],
    },
    {
      id: "portfolio",
      title: "Portfolio",
      rows: [
        {
          id: "applications",
          label: "2026 Applications",
          values: profiles.map((p) => num(p.applicationCount)),
          emphasizeDifference: true,
        },
        {
          id: "brand",
          label: "Brand Applications",
          values: profiles.map((p) => num(p.brandApplicationCount)),
          emphasizeDifference: true,
        },
        {
          id: "brand-share",
          label: "Brand share",
          values: profiles.map((p) =>
            p.applicationCount > 0
              ? text(`${p.brandApplicationCount} of ${p.applicationCount}`)
              : unavailable(),
          ),
        },
        {
          id: "strings",
          label: "Applied strings preview",
          values: profiles.map((p) =>
            text(stringsPreview(p.portfolio.map((row) => row.appliedForString).filter(Boolean))),
          ),
        },
      ],
    },
    {
      id: "brand-section",
      title: "Brand",
      rows: [
        {
          id: "brand-count",
          label: "Brand Applications",
          values: profiles.map((p) => num(p.brandApplicationCount)),
          emphasizeDifference: true,
        },
      ],
    },
    {
      id: "contention",
      title: "Contention",
      rows: [
        {
          id: "memberships",
          label: "Application contention memberships",
          values: profiles.map((p) => num(p.contentionMemberships)),
          emphasizeDifference: true,
          note: "Memberships, sets, and Applicants are distinct measures — not interchangeable.",
        },
        {
          id: "unique-sets",
          label: "Unique official contention sets",
          values: profiles.map((p) => num(p.uniqueContentionSets)),
          emphasizeDifference: true,
        },
        {
          id: "applicants-in-contention",
          label: "Applicant entities represented in contention",
          values: profiles.map((p) => {
            const names = new Set(
              p.contentionSets.flatMap((s) => s.organizationApplicantNames),
            );
            return num(names.size);
          }),
          emphasizeDifference: true,
        },
        {
          id: "counterparts",
          label: "Distinct external counterpart Applicants",
          values: profiles.map((p) => num(p.distinctExternalCounterpartApplicants)),
          emphasizeDifference: true,
        },
      ],
    },
    {
      id: "rsp",
      title: "RSP",
      rows: [
        {
          id: "rsp-among",
          label: "Public Main-RSP posture among mapped Applicants",
          values: profiles.map(organizationRspSummary),
          note: "Organization-level selected RSP is not inferred. Selected RSP is not established by public Applicant data.",
        },
      ],
    },
    {
      id: "historical",
      title: "Historical participation",
      rows: [
        {
          id: "hist-2012",
          label: "Confirmed 2012 Applications",
          values: hist.map((h) => h.apps2012),
          emphasizeDifference: true,
        },
        {
          id: "hist-2026",
          label: "2026 Applications",
          values: hist.map((h) => h.apps2026),
          emphasizeDifference: true,
        },
        {
          id: "hist-delta",
          label: "2026 vs 2012 absolute delta",
          values: hist.map((h) => h.delta),
          emphasizeDifference: true,
          note: hist[0]?.note,
        },
      ],
    },
    {
      id: "evidence",
      title: "Evidence / confidence",
      rows: [
        {
          id: "mapping-count",
          label: "Confirmed Applicant mappings",
          values: profiles.map((p) => num(p.evidenceSummary.mappingCount)),
        },
        {
          id: "evidence-types",
          label: "Evidence types",
          values: profiles.map((p) =>
            p.evidenceSummary.evidenceTypeLabels.length
              ? text(p.evidenceSummary.evidenceTypeLabels.join("; "))
              : unavailable(),
          ),
        },
      ],
    },
  ];
}

export type BuildCompareIntelInput = {
  document: RegistryApplicationsDocumentV2;
  overlays: ParticipantOverlays | undefined;
  evaluatedRsp: EvaluatedMainRspArtifact;
  orgSnapshot: OrganizationResolutionSnapshot;
  type: string | null | undefined;
  idsRaw: string | null | undefined;
};

/**
 * Build comparison view model for Applicant or Confirmed Organization grain.
 * Mixed grains are rejected with an explanatory empty state.
 */
export function buildCompareIntelViewModel(input: BuildCompareIntelInput): CompareIntelViewModel {
  const warnings: string[] = [];
  const rawType = input.type?.trim() ?? "";
  const ids = decodeCompareIntelIds(input.idsRaw).slice(0, COMPARE_INTEL_MAX);

  if (!rawType && ids.length === 0) {
    return {
      grain: "organization",
      title: "Compare",
      subtitle: "Select Applicants or Confirmed Organizations to compare portfolio, Brand, contention, RSP, and confirmed cross-round history.",
      columns: [],
      sections: [],
      shareHref: "/compare",
      contentionHref: null,
      emptyReason: "No selections yet. Add entities from Applicant Profiles, Organization Profiles, Competitive Landscape, Explore, or Contention.",
      warnings,
    };
  }

  if (!isCompareIntelEntityType(rawType)) {
    return {
      grain: "organization",
      title: "Compare",
      subtitle: "Applicant and Organization comparison",
      columns: [],
      sections: [],
      shareHref: "/compare",
      contentionHref: null,
      emptyReason:
        rawType === "organizations" || rawType === "applications" || rawType === "categories"
          ? "This Compare URL uses the older rehearsal entity model. Use type=applicant or type=organization with canonical keys."
          : `Unknown comparison type “${rawType || "(empty)"}”. Supported: applicant, organization.`,
      warnings,
    };
  }

  if (ids.length === 0) {
    return {
      grain: rawType,
      title: rawType === "applicant" ? "Compare Applicants" : "Compare Organizations",
      subtitle: "Add at least two like entities to open a side-by-side comparison.",
      columns: [],
      sections: [],
      shareHref: compareIntelHref(rawType, []),
      contentionHref: null,
      emptyReason: "No entity ids in the Compare URL.",
      warnings,
    };
  }

  if (rawType === "applicant") {
    const columns: CompareIntelColumn[] = ids.map((key) => {
      const lookup = buildApplicantIntelligenceProfile(
        input.document,
        input.overlays,
        input.evaluatedRsp,
        key,
      );
      return {
        grain: "applicant" as const,
        key,
        label: lookup.found ? lookup.applicantLegalName : key,
        profileHref: lookup.profileHref,
        lookup,
      };
    });
    const found = columns.filter((c) => c.lookup.found).map((c) => c.lookup as ApplicantIntelligenceProfile);
    const missing = columns.filter((c) => !c.lookup.found);
    if (missing.length) {
      warnings.push(
        `Unknown Applicant${missing.length > 1 ? "s" : ""}: ${missing.map((c) => c.key).join("; ")}.`,
      );
    }
    if (found.length === 0) {
      return {
        grain: "applicant",
        title: "Compare Applicants",
        subtitle: "Exact ICANN-published legal applying entities.",
        columns,
        sections: [],
        shareHref: compareIntelHref("applicant", ids),
        contentionHref: null,
        emptyReason: "None of the selected Applicant legal names matched represented Application data.",
        warnings,
      };
    }
    if (found.length === 1 && ids.length === 1) {
      warnings.push("Add at least one more Applicant for side-by-side differences.");
    }
    return {
      grain: "applicant",
      title: "Compare Applicants",
      subtitle:
        "Applicant comparison — exact ICANN-published legal applying entities. Organization aggregates are not substituted for Applicant metrics.",
      columns,
      sections: buildApplicantSections(found),
      shareHref: compareIntelHref(
        "applicant",
        columns.filter((c) => c.lookup.found).map((c) => c.key),
      ),
      contentionHref: found[0]?.contentionHref ?? "/contention?view=all",
      warnings,
    };
  }

  // organization grain
  const columns: Extract<CompareIntelColumn, { grain: "organization" }>[] = ids.map((key) => {
    const lookup = buildOrganizationIntelligenceProfile(
      input.document,
      input.overlays,
      input.evaluatedRsp,
      input.orgSnapshot,
      key,
    );
    return {
      grain: "organization" as const,
      key,
      label: lookup.found ? lookup.canonicalName : key,
      profileHref: lookup.profileHref,
      lookup,
    };
  });
  const found = columns.filter((c) => c.lookup.found).map((c) => c.lookup as OrganizationIntelligenceProfile);
  for (const col of columns) {
    if (col.lookup.found) continue;
    if (col.lookup.reason === "not-confirmed") {
      warnings.push(
        `“${col.key}” is not a steward-Confirmed Organization — Candidate/Ambiguous identities cannot enter Organization comparison.`,
      );
    } else {
      warnings.push(`Unknown Organization key: ${col.key}.`);
    }
  }
  if (found.length === 0) {
    return {
      grain: "organization",
      title: "Compare Organizations",
      subtitle: "Confirmed Organization comparison — evidence-backed groupings of legal Applicants.",
      columns,
      sections: [],
      shareHref: compareIntelHref("organization", ids),
      contentionHref: null,
      emptyReason:
        "No steward-Confirmed Organizations matched. Do not invent fallback Organizations from unresolved Applicants.",
      warnings,
    };
  }
  if (found.length === 1 && ids.length === 1) {
    warnings.push("Add at least one more Confirmed Organization for side-by-side differences.");
  }
  return {
    grain: "organization",
    title: "Compare Organizations",
    subtitle:
      "Organization comparison — aggregates across mapped legal Applicants. Organization is not the formal ICANN Applicant.",
    columns,
    sections: buildOrganizationSections(found),
    shareHref: compareIntelHref(
      "organization",
      columns.filter((c) => c.lookup.found).map((c) => c.key),
    ),
    contentionHref: found[0]?.contentionHref ?? "/contention?view=all",
    warnings,
  };
}

export function formatCompareMetricValue(value: CompareMetricValue): string {
  if (value.kind === "number") return String(value.value);
  if (value.kind === "text") return value.value;
  return value.label ?? "Not available";
}

export function numericValuesDiffer(values: CompareMetricValue[]): boolean {
  const nums = values.filter((v): v is { kind: "number"; value: number } => v.kind === "number");
  if (nums.length < 2) return false;
  return nums.some((n) => n.value !== nums[0]!.value);
}
