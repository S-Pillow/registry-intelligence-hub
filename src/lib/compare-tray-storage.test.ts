import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addToCompareTray,
  clearCompareTray,
  compareTrayOpenHref,
  readCompareTray,
  removeFromCompareTray,
  writeCompareTray,
} from "@/lib/compare-tray-storage";

function installSessionStorage(): void {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
    },
  });
}

describe("compare tray storage", () => {
  beforeEach(() => {
    installSessionStorage();
  });
  afterEach(() => {
    clearCompareTray();
  });

  it("stores homogeneous Applicant selections and builds open href", () => {
    expect(addToCompareTray("applicant", { key: "Salesforce, Inc.", label: "Salesforce, Inc." }).ok).toBe(
      true,
    );
    expect(
      addToCompareTray("applicant", { key: "Hair Apparent, LLC", label: "Hair Apparent, LLC" }).ok,
    ).toBe(true);
    const tray = readCompareTray();
    expect(tray?.type).toBe("applicant");
    expect(tray?.items).toHaveLength(2);
    expect(compareTrayOpenHref(tray!)).toContain("type=applicant");
    expect(compareTrayOpenHref(tray!)).toContain("ids=");
  });

  it("prevents mixed-grain selection", () => {
    addToCompareTray("organization", { key: "identity-digital", label: "Identity Digital" });
    const result = addToCompareTray("applicant", { key: "Salesforce, Inc.", label: "Salesforce, Inc." });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("mixed-grain");
      expect(result.message).toMatch(/mixed grains/i);
    }
    expect(readCompareTray()?.type).toBe("organization");
  });

  it("supports remove and clear", () => {
    writeCompareTray({
      type: "organization",
      items: [
        { key: "identity-digital", label: "Identity Digital" },
        { key: "namecheap", label: "Namecheap" },
      ],
    });
    removeFromCompareTray("namecheap");
    expect(readCompareTray()?.items).toHaveLength(1);
    clearCompareTray();
    expect(readCompareTray()).toBeNull();
  });
});
