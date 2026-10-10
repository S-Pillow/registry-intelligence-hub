import type { EvidenceSourceClassification } from "./evidence-source-classification";

/** Draft `rsp-relationship/1.0.0` — no auto role assignment. */
export const RSP_RELATIONSHIP_SCHEMA_VERSION = "rsp-relationship/1.0.0" as const;

export type RspRelationshipRole = string;

export interface RspRelationshipTemporal {
  livePortion: "current_public_portion";
  changeHistoryStatus: "not_checked";
}

export interface RspRelationshipDraft {
  schemaVersion: typeof RSP_RELATIONSHIP_SCHEMA_VERSION;
  applicationId: string;
  rspKey: string;
  providerNameAsStated: string;
  roles: RspRelationshipRole[];
  sourceFieldPath: string;
  evidenceClassification?: EvidenceSourceClassification;
  temporal: RspRelationshipTemporal;
  reviewState: "DRAFT" | "REQUIRES_STEWARD_REVIEW";
}

export function defaultRspRelationshipTemporal(): RspRelationshipTemporal {
  return { livePortion: "current_public_portion", changeHistoryStatus: "not_checked" };
}
