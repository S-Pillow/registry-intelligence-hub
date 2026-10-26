import type { RegistrarClassification } from "./types";

/** Spec 3 / Spec 5 special registry-as-registrar and pre-delegation test IDs. */
export const SPECIAL_IANA_IDS = new Set(["9995", "9996", "9997", "9998", "9999"]);

export function classifyRegistrarRow(
  registrarName: string,
  ianaId: string,
): RegistrarClassification {
  if (registrarName.trim().toLowerCase() === "totals") return "TOTALS";
  const id = ianaId.trim();
  if (SPECIAL_IANA_IDS.has(id)) return "SPECIAL_REGISTRY_OR_SYSTEM";
  if (/^\d+$/.test(id) && Number(id) > 0 && Number(id) < 9995) {
    return "ACCREDITED_OR_STANDARD";
  }
  if (id === "" && registrarName.trim().toLowerCase() === "totals") return "TOTALS";
  return "UNKNOWN_OR_UNCLASSIFIED";
}

export function isBreadthEligible(
  classification: RegistrarClassification,
  totalDomains: number,
): boolean {
  return classification === "ACCREDITED_OR_STANDARD" && totalDomains > 0;
}
