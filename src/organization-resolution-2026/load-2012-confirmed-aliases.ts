import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { OrganizationPromotionRegistry } from "@/normalization/types";

export type Confirmed2012ApplicantAlias = {
  applicantLegalName: string;
  organizationKey: string;
  canonicalOrganizationName: string;
  promotionState: "CONFIRMED";
};

/**
 * Exact published 2012 Applicant legal names that appear in CONFIRMED promotion ops.
 * Used only as candidate historical match hints for 2026 — never auto-confirm or return/new.
 */
export async function loadConfirmed2012ApplicantAliases(
  workspaceRoot: string,
): Promise<Map<string, Confirmed2012ApplicantAlias>> {
  const registryPath = join(
    workspaceRoot,
    "src/normalization/fixtures/icann2012-reveal-day-v1/organization-promotions.json",
  );
  const csvPath = join(
    workspaceRoot,
    "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
  );

  const registry = JSON.parse(await readFile(registryPath, "utf8")) as OrganizationPromotionRegistry;
  const appToOrg = new Map<string, { organizationKey: string; canonicalOrganizationName: string }>();
  for (const op of registry.operations) {
    if (op.promotionState !== "CONFIRMED") continue;
    for (const applicationId of op.applicationIds) {
      appToOrg.set(applicationId, {
        organizationKey: op.organizationKey,
        canonicalOrganizationName: op.canonicalOrganizationName,
      });
    }
  }

  const aliases = new Map<string, Confirmed2012ApplicantAlias>();
  const rl = createInterface({ input: createReadStream(csvPath, { encoding: "utf8" }), crlfDelay: Infinity });
  let header: string[] | null = null;
  let appIdIdx = -1;
  let applicantIdx = -1;

  for await (const line of rl) {
    if (!header) {
      header = parseCsvLine(line);
      appIdIdx = header.indexOf("Application ID");
      applicantIdx = header.indexOf("Applicant");
      if (appIdIdx < 0 || applicantIdx < 0) {
        throw new Error("2012 Reveal Day CSV missing Application ID or Applicant columns");
      }
      continue;
    }
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    const applicationId = cells[appIdIdx] ?? "";
    const applicantLegalName = cells[applicantIdx] ?? "";
    const org = appToOrg.get(applicationId);
    if (!org || !applicantLegalName) continue;
    aliases.set(applicantLegalName, {
      applicantLegalName,
      organizationKey: org.organizationKey,
      canonicalOrganizationName: org.canonicalOrganizationName,
      promotionState: "CONFIRMED",
    });
  }

  return aliases;
}

/** Minimal CSV line parser supporting quoted fields. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
