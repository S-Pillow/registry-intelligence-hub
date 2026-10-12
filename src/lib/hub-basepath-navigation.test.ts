import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applicantProfileHref } from "@/lib/applicant-intelligence";
import { HUB_BASE_PATH, withBasePath } from "@/lib/hub-paths";
import { organizationProfileHref } from "@/lib/organization-intelligence";

/**
 * ORG-INTEL-1A — basePath-safe internal navigation.
 * next/link owns the production prefix; helpers must stay app-relative.
 * Raw `<a href="/…">` bypasses basePath and escapes to the ForgeForward root.
 */
describe("ORG-INTEL-1A hub basePath navigation", () => {
  it("keeps profile helpers app-relative for Next Link", () => {
    expect(organizationProfileHref("salesforce")).toBe("/organization?key=salesforce");
    expect(applicantProfileHref("Salesforce, Inc.")).toBe(
      `/applicant?name=${encodeURIComponent("Salesforce, Inc.")}`,
    );
    expect(organizationProfileHref("salesforce").startsWith(HUB_BASE_PATH)).toBe(false);
    expect(applicantProfileHref("Salesforce, Inc.").startsWith(HUB_BASE_PATH)).toBe(false);
  });

  it("withBasePath maps app routes onto the production mount", () => {
    expect(withBasePath("/contention")).toBe(`${HUB_BASE_PATH}/contention`);
    expect(withBasePath("/organization?key=salesforce")).toBe(
      `${HUB_BASE_PATH}/organization?key=salesforce`,
    );
    expect(withBasePath("/applicant?name=Salesforce%2C%20Inc.")).toBe(
      `${HUB_BASE_PATH}/applicant?name=Salesforce%2C%20Inc.`,
    );
    expect(withBasePath("/contention")).not.toBe("/contention");
  });

  it("Command Center orientation does not use raw root-relative contention anchors", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/registry/command-center-orientation-v2.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/<a\s+href=["']\/contention["']/);
    expect(source).toMatch(/href=["']\/contention["']/);
    expect(source).toMatch(/Inspect actual sets on Contention/);
    expect(source).toMatch(/data-testid=["']cc-v2-inspect-contention-sets["']/);
  });

  it("Organization / Applicant / Contention / CL profile surfaces avoid raw internal anchors", () => {
    const files = [
      "src/components/registry/organization-profile-content.tsx",
      "src/components/registry/applicant-profile-content.tsx",
      "src/components/registry/contention-content.tsx",
      "src/components/registry/competitive-landscape-content.tsx",
    ];
    for (const rel of files) {
      const source = readFileSync(path.join(process.cwd(), rel), "utf8");
      const rawInternal = source.match(/<a\s+[^>]*href=["']\/(?:explore|competitive-landscape|contention|applicant|organization|changes|data-health|compare|saved|briefings)(?:[?"']|\/)/g);
      expect(rawInternal, `${rel} must not use raw internal <a href="/…">`).toBeNull();
    }
  });
});
