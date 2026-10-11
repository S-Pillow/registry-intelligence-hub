"use client";

import { Badge } from "@/components/ui/badge";
import {
  ORGANIZATION_MAPPING_EXPLANATIONS,
  organizationMappingLabel,
} from "@/lib/rsp-opportunity-intelligence";
import type { OrganizationResolutionOverlayStatus } from "@/lib/participant-intelligence";

export function OrganizationMappingBadge({
  status,
  name,
}: {
  status: OrganizationResolutionOverlayStatus | string;
  name: string | null;
}) {
  const typed = status as OrganizationResolutionOverlayStatus;
  const label = organizationMappingLabel(typed, name);
  if (typed === "CONFIRMED" && name) {
    return (
      <Badge variant="outline" className="bg-emerald-100 text-[#006a56]" data-testid="org-confirmed-badge">
        {label}
      </Badge>
    );
  }
  if (typed === "CANDIDATE") {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-900" data-testid="org-candidate-badge">
        {label}
      </Badge>
    );
  }
  if (typed === "AMBIGUOUS") {
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-900" data-testid="org-ambiguous-badge">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-slate-100 text-slate-700" data-testid="org-unresolved-badge">
      {label}
    </Badge>
  );
}

export function OrganizationMappingExplainer() {
  return (
    <details
      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
      data-testid="org-mapping-explainer"
    >
      <summary className="cursor-pointer font-semibold text-slate-900">
        What do organization mappings mean?
      </summary>
      <p className="mt-2 text-slate-700">{ORGANIZATION_MAPPING_EXPLANATIONS.preamble}</p>
      <dl className="mt-2 space-y-2 text-slate-700">
        <div>
          <dt className="font-medium text-slate-900">Confirmed · Organization</dt>
          <dd>{ORGANIZATION_MAPPING_EXPLANATIONS.CONFIRMED}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Candidate match</dt>
          <dd>{ORGANIZATION_MAPPING_EXPLANATIONS.CANDIDATE}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Identity ambiguous</dt>
          <dd>{ORGANIZATION_MAPPING_EXPLANATIONS.AMBIGUOUS}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Not yet resolved</dt>
          <dd>{ORGANIZATION_MAPPING_EXPLANATIONS.UNRESOLVED}</dd>
        </div>
      </dl>
    </details>
  );
}
