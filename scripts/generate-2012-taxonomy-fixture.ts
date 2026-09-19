import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseRevealDayCsvText } from "../src/normalization/parse-reveal-csv";
import { classify2012RevealDayApplications } from "../src/registry-market-taxonomy/classify-2012";
import { REGISTRY_MARKET_TAXONOMY_VERSION } from "../src/registry-market-taxonomy/taxonomy-1.0";

const root = join(import.meta.dirname, "..");
const csvPath = join(root, "src/normalization/fixtures/icann2012-reveal-day-v1/sources/strings-1200utc-13jun12-en.csv");
const outPath = join(root, "src/normalization/fixtures/icann2012-reveal-day-v1/application-taxonomy.json");

async function main(): Promise<void> {
  const csv = await readFile(csvPath, "utf8");
  const records = classify2012RevealDayApplications(parseRevealDayCsvText(csv));
  const payload = {
    taxonomyVersion: REGISTRY_MARKET_TAXONOMY_VERSION,
    applicationCount: records.length,
    records,
  };
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${records.length} taxonomy records to ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
