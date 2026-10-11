import { describe, expect, it } from "vitest";
import { extractRegistrableWebsiteDomain, normalizeApplicantWebsite } from "./website-normalize";

describe("normalizeApplicantWebsite", () => {
  it("normalizes identity.digital deterministically", () => {
    const a = normalizeApplicantWebsite("https://www.identity.digital");
    const b = normalizeApplicantWebsite("http://Identity.Digital/");
    const c = normalizeApplicantWebsite("HTTPS://www.identity.digital/path?x=1#frag");
    expect(a.status).toBe("OK");
    expect(b.status).toBe("OK");
    expect(c.status).toBe("OK");
    if (a.status !== "OK" || b.status !== "OK" || c.status !== "OK") return;
    expect(a.normalized.registrableWebsiteDomain).toBe("identity.digital");
    expect(b.normalized.registrableWebsiteDomain).toBe("identity.digital");
    expect(c.normalized.registrableWebsiteDomain).toBe("identity.digital");
    expect(a.normalized.normalizedWebsiteHost).toBe("identity.digital");
    expect(b.normalized.normalizedWebsiteHost).toBe("identity.digital");
    expect(a.normalized.normalizedWebsiteUrl).toBe("https://identity.digital");
    expect(c.normalized.normalizedWebsiteUrl).toBe("https://identity.digital/path");
  });

  it("strips www, case, trailing slash, and scheme variance", () => {
    const r = normalizeApplicantWebsite("http://www.gtldtechedge.com/");
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    expect(r.normalized.registrableWebsiteDomain).toBe("gtldtechedge.com");
    expect(r.normalized.normalizedWebsiteHost).toBe("gtldtechedge.com");
    expect(r.normalized.normalizedWebsiteUrl).toBe("https://gtldtechedge.com");
  });

  it("handles missing and invalid URLs", () => {
    expect(normalizeApplicantWebsite(null).status).toBe("MISSING_WEBSITE");
    expect(normalizeApplicantWebsite("").status).toBe("MISSING_WEBSITE");
    expect(normalizeApplicantWebsite("not a url").status).toBe("INVALID_OR_UNUSABLE_WEBSITE");
    expect(normalizeApplicantWebsite("ftp://example.com").status).toBe("INVALID_OR_UNUSABLE_WEBSITE");
    expect(normalizeApplicantWebsite("https://example.com").status).toBe("INVALID_OR_UNUSABLE_WEBSITE");
  });

  it("extracts multi-part public suffixes", () => {
    expect(extractRegistrableWebsiteDomain("www.xserver.co.jp")).toBe("xserver.co.jp");
    expect(extractRegistrableWebsiteDomain("cloud.xserver.co.jp")).toBe("xserver.co.jp");
  });
});
