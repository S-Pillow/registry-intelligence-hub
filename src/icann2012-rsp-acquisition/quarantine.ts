import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
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

export function validatePortionHtml(html: string): { ok: true } | { ok: false; reason: QuarantineReason } {
  if (!html.includes('div class="response" id="q23"') && !html.includes('id="q23"')) {
    return { ok: false, reason: "incomplete-portion-q23" };
  }
  return { ok: true };
}
