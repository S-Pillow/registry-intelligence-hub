/** Server/CLI-only loaders for promotion-contract-2x (node:fs). Keep out of client bundles. */

import { readFile } from "node:fs/promises";
import type { RevealDayEvidenceBundleV1, ContentionMembershipSnapshotV1 } from "./contention-membership-types";
import type { Registry2026PublicationV2 } from "./publication-v2-types";
import { validatePublicationV2, validationV2Failed } from "./validate-v2";
import { validateContentionMembershipSnapshot } from "./validate-contention-membership";

export async function loadPublicationV2FromPath(path: string): Promise<Registry2026PublicationV2> {
  const text = await readFile(path, "utf8");
  const raw = JSON.parse(text) as unknown;
  const { snapshot, issues } = validatePublicationV2(raw);
  if (!snapshot || validationV2Failed(issues)) {
    const messages = issues.filter((i) => i.severity === "error").map((i) => `${i.code}: ${i.message}`);
    throw new Error(`Publication 2.0.0 validation failed:\n${messages.join("\n")}`);
  }
  return snapshot;
}

export async function loadContentionMembershipFromPath(path: string): Promise<ContentionMembershipSnapshotV1> {
  const text = await readFile(path, "utf8");
  const raw = JSON.parse(text) as unknown;
  const { snapshot, issues } = validateContentionMembershipSnapshot(raw);
  if (!snapshot || issues.some((i) => i.severity === "error")) {
    const messages = issues.filter((i) => i.severity === "error").map((i) => `${i.code}: ${i.message}`);
    throw new Error(`Contention membership validation failed:\n${messages.join("\n")}`);
  }
  return snapshot;
}

export async function loadEvidenceBundleFromPath(path: string): Promise<RevealDayEvidenceBundleV1> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as RevealDayEvidenceBundleV1;
}
