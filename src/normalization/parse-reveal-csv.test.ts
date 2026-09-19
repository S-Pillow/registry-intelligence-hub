import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRevealDayCsvText } from "./parse-reveal-csv";

const csvPath = join(
  import.meta.dirname,
  "fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv",
);

describe("Reveal Day CSV parser", () => {
  it("parses the committed 1,930-application fixture", async () => {
    const text = await readFile(csvPath, "utf8");
    const rows = parseRevealDayCsvText(text);
    expect(rows).toHaveLength(1930);
    const idns = rows.filter((r) => r.isIdn);
    expect(idns.length).toBe(116);
    expect(rows.every((r) => r.applicationId.match(/^1-\d+-\d+$/))).toBe(true);
  });
});
