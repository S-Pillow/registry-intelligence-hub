import { describe, expect, it } from "vitest";
import {
  participationStatusCellForApplication,
  participationStatusCellForOrganization,
} from "./compare-dimensions";

describe("compare-dimensions eligibility", () => {
  it("does not present fixture returning flag as a comparable outcome metric", () => {
    const returning = participationStatusCellForOrganization(true);
    expect(returning.state).toBe("unavailable");
    expect(returning.methodReadiness).toBe("BLOCKED_SOURCE");
    expect(String(returning.value)).toMatch(/not available|not ingested/i);

    const newParticipant = participationStatusCellForOrganization(false);
    expect(newParticipant.state).toBe("unavailable");
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
