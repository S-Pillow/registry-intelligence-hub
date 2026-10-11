import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  emailDomainFromBusinessEmail,
  extractIdentityFieldsFromResponses,
  extractOrganizationWebsite,
  truthyResponse,
  type ApsApplicationSummary,
} from "./aps-detail";

const FIX = join(process.cwd(), "src/organization-resolution-2026/fixtures/aps-detail");

describe("APS application detail extraction — Hair Apparent proof fixture", () => {
  it("extracts Applicant Website from summary", () => {
    const summary = JSON.parse(
      readFileSync(join(FIX, "SS2654T-T11896.summary.json"), "utf8"),
    ) as ApsApplicationSummary;
    expect(summary.applicationHumanReadableId).toBe("SS2654T-T11896");
    expect(summary.applicantDetails?.organizationName).toBe("Hair Apparent, LLC");
    expect(extractOrganizationWebsite(summary)).toBe("https://www.identity.digital");
  });

  it("extracts Q11/Q12/Q14/Q19/Q26/Q36/Q108 from identity extract", () => {
    const identity = JSON.parse(readFileSync(join(FIX, "SS2654T-T11896.identity.json"), "utf8")) as {
      fields: Record<string, { responseText?: string; questionText?: string }>;
    };
    // Re-validate via parser over a minimal responses body rebuilt from extract
    const body = {
      questionAndResponses: {
        sections: [
          {
            sectionTitle: "Applying Entity Information",
            questions: Object.values(identity.fields).map((f) => ({
              questionText: f.questionText,
              responseText: f.responseText,
            })),
          },
        ],
      },
    };
    const extracted = extractIdentityFieldsFromResponses("SS2654T-T11896", body);
    expect(truthyResponse(extracted.fields.Q11?.responseText)).toBe(true);
    expect(extracted.fields.Q12?.responseText).toMatch(/Identity Digital Domains Limited/i);
    expect(extracted.fields.Q14?.responseText).toMatch(/Identity Digital Limited/i);
    expect(emailDomainFromBusinessEmail(extracted.fields.Q19?.responseText)).toBe("identity.digital");
    expect(extracted.fields.Q26?.responseText).toBe("Slow Rider, LLC");
    expect(extracted.fields.Q36?.responseText).toBe("Ethos Capital Digital Infrastructure UGP LLC");
    expect(extracted.fields.Q108?.responseText).toBe("Ethos Capital Digital Infrastructure UGP LLC");
  });
});
