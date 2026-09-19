import { describe, expect, it } from "vitest";
import { participationStatusCellForOrganization } from "./compare-dimensions";

describe("compare-dimensions eligibility", () => {
  it("does not present fixture returning flag as a comparable outcome metric", () => {
    const returning = participationStatusCellForOrganization(true);
    expect(returning.state).toBe("not-comparable");
    expect(returning.readiness).toBe("PARTIAL");
    expect(String(returning.value)).toMatch(/outcome not verified/i);

    const newParticipant = participationStatusCellForOrganization(false);
    expect(newParticipant.state).toBe("not-comparable");
  });
});
