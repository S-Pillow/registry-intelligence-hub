/**
 * Evidence source classifications for RSP relationship promotion (draft contract).
 * Validation leads are labels only — never auto-CONFIRMED facts.
 */
export const EVIDENCE_SOURCE_CLASSIFICATIONS = [
  "PUBLIC_ICANN",
  "PUBLIC_ARCHIVE_OF_ICANN",
  "INTERNAL_GODADDY",
  "STEWARD_ASSERTED",
  "PUBLIC_CORPORATE_LINEAGE",
  "THIRD_PARTY_VALIDATION_LEAD",
] as const;

export type EvidenceSourceClassification = (typeof EVIDENCE_SOURCE_CLASSIFICATIONS)[number];

export function isEvidenceSourceClassification(value: string): value is EvidenceSourceClassification {
  return (EVIDENCE_SOURCE_CLASSIFICATIONS as readonly string[]).includes(value);
}
