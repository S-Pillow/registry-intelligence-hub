import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCrossRoundIdentityReport,
  validateCrossRoundIdentityRegistry,
} from "./method-1.0.0";
import { CROSS_ROUND_IDENTITY_METHOD_VERSION } from "./types";

const registryPath = join(import.meta.dirname, "fixtures/rehearsal-identity-link-registry.json");

describe("cross-round-identity/1.0.0", () => {
  it("validates versioned registry and rejects duplicate pairs", () => {
    const registry = JSON.parse(readFileSync(registryPath, "utf8"));
    expect(registry.methodVersion).toBe(CROSS_ROUND_IDENTITY_METHOD_VERSION);
    validateCrossRoundIdentityRegistry(registry);

    const duplicate = {
      ...registry,
      links: [...registry.links, { ...registry.links[0], linkId: "dup" }],
    };
    expect(() => validateCrossRoundIdentityRegistry(duplicate)).toThrow(/duplicate identity pair/i);
  });

  it("reports rehearsal links without claiming real 2026 identity", () => {
    const registry = JSON.parse(readFileSync(registryPath, "utf8"));
    const report = buildCrossRoundIdentityReport(registry);
    expect(report.linkCount).toBe(2);
    expect(report.links.every((l) => l.claimsReal2026Identity === false)).toBe(true);
    expect(report.disclaimer).toMatch(/do not assert real 2026/i);
  });
});
