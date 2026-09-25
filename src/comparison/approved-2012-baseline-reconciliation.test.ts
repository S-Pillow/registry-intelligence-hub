import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRevealDayCsvText } from "@/normalization/parse-reveal-csv";
import { APPROVED_2012_BASELINE } from "./approved-2012-baseline";

const csvPath = join(
  import.meta.dirname,
  "../normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
);

describe("approved 2012 baseline reconciliation", () => {
  it("matches committed Reveal Day CSV aggregates in APPROVED_2012_BASELINE", async () => {
    const text = await readFile(csvPath, "utf8");
    const rows = parseRevealDayCsvText(text);

    expect(rows).toHaveLength(APPROVED_2012_BASELINE.applications);
    expect(new Set(rows.map((row) => row.stringUlabel)).size).toBe(APPROVED_2012_BASELINE.uniqueStrings);
    expect(rows.filter((row) => row.isIdn).length).toBe(APPROVED_2012_BASELINE.idnApplications);
    const yes = (value: string | null | undefined) => (value ?? "").trim().toLowerCase() === "yes";
    expect(rows.filter((row) => yes(row.preservedColumns["Community?"])).length).toBe(
      APPROVED_2012_BASELINE.communityDesignations,
    );
    expect(rows.filter((row) => yes(row.preservedColumns["Geographic?"])).length).toBe(
      APPROVED_2012_BASELINE.geographicDesignations,
    );
  });
});
