import { describe, expect, it } from "vitest";
import {
  participationStatusCellForApplication,
  participationStatusCellForOrganization,
} from "./compare-dimensions";

describe("compare-dimensions eligibility", () => {
  it("does not present fixture returning flag as a comparable outcome metric", () => {
    const returning = participationStatusCellForOrganization(true);
    expect(returning.state).toBe("not-comparable");
    expect(returning.methodReadiness).toBe("PARTIAL");
    expect(String(returning.value)).toMatch(/outcome not verified/i);

    const newParticipant = participationStatusCellForOrganization(false);
    expect(newParticipant.state).toBe("not-comparable");
  });

  it("does not present application returning flags as verified cross-round outcomes", () => {
    const returning = participationStatusCellForApplication(true);
    expect(returning.state).toBe("not-comparable");
    expect(String(returning.value)).toMatch(/outcome not verified/i);

    const newApp = participationStatusCellForApplication(false);
    expect(newApp.state).toBe("not-comparable");
    expect(String(newApp.value)).toMatch(/fixture/i);
  });
});
