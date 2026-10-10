import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { validatePublicPortionDocument } from "./public-portion-validation";
import type { QuarantineRecord, QuarantineReason } from "./types";

export async function writeQuarantineRecord(
  quarantineRoot: string,
  applicationId: string,
  reason: QuarantineReason,
  detail: string,
): Promise<QuarantineRecord> {
  const record: QuarantineRecord = {
    applicationId,
    reason,
    detail,
    quarantinedAt: new Date().toISOString(),
  };
  const dir = join(quarantineRoot, applicationId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "quarantine.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export function validatePortionHtml(
  html: string,
  options?: { expectedApplicationId?: string },
): { ok: true } | { ok: false; reason: QuarantineReason } {
  const result = validatePublicPortionDocument(html, options);
  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true };
}
