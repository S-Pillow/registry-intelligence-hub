import { describe, expect, it } from "vitest";
import { defaultSyntheticGridParserFixturePath } from "./grid-evidence-paths";
import { runMappingDryRun } from "./mapping-dry-run";
import { mergeGridRowsIntoMapping, parseViewstatusGridHtml } from "./viewstatus-parser";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const workspaceRoot = join(process.cwd());

describe("viewstatus grid parser (bounded blocks)", () => {
  it("pairs Application ID and detail link within the same tr block", () => {
    const html = `
      <tr data-gtldresult-ac-id="170" data-tas-application-id="1-1945-29108">
        <a href="/applicationstatus/viewstatus:viewapplicationdetails/170">Details</a>
      </tr>
    `;
    const { rows, quarantinedBlocks } = parseViewstatusGridHtml(html);
    expect(quarantinedBlocks).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].tasApplicationId).toBe("1-1945-29108");
    expect(rows[0].gtldresultAcId).toBe(170);
  });

  it("does not pair Application ID and detail link from different document regions", () => {
    const html = `
      <tr data-gtldresult-ac-id="170" data-tas-application-id="1-1945-29108"></tr>
      <a href="/applicationstatus/viewapplicationdetails/501">x</a>
      Application ID: </span> <span>1-1311-58570</span>
    `;
    const { rows } = parseViewstatusGridHtml(html);
    const map = mergeGridRowsIntoMapping(rows);
    expect(map.get("1-1945-29108")).toBe(170);
    expect(map.has("1-1311-58570")).toBe(false);
  });

  it("survives reordered tr rows", () => {
    const html = `
      <tr data-gtldresult-ac-id="222" data-tas-application-id="1-9999-00002"></tr>
      <tr data-gtldresult-ac-id="111" data-tas-application-id="1-9999-00001"></tr>
    `;
    const map = mergeGridRowsIntoMapping(parseViewstatusGridHtml(html).rows);
    expect(map.get("1-9999-00001")).toBe(111);
    expect(map.get("1-9999-00002")).toBe(222);
  });

  it("ignores unrelated detail links outside the row block", () => {
    const html = `
      <tr data-gtldresult-ac-id="333" data-tas-application-id="1-9999-00003"></tr>
      <footer><a href="/applicationstatus/viewapplicationdetails/9999">other</a></footer>
    `;
    const map = mergeGridRowsIntoMapping(parseViewstatusGridHtml(html).rows);
    expect(map.get("1-9999-00003")).toBe(333);
    expect(map.size).toBe(1);
  });

  it("quarantines duplicate Application ID with different ac in separate blocks", () => {
    const html = `
      <tr data-gtldresult-ac-id="10" data-tas-application-id="1-9999-00004"></tr>
      <tr data-gtldresult-ac-id="20" data-tas-application-id="1-9999-00004"></tr>
    `;
    const { rows, quarantinedBlocks } = parseViewstatusGridHtml(html);
    expect(rows).toHaveLength(1);
    expect(quarantinedBlocks.some((q) => q.reason.includes("duplicate"))).toBe(true);
  });

  it("quarantines duplicate ac id mapped to different Application IDs", () => {
    const html = `
      <tr data-gtldresult-ac-id="44" data-tas-application-id="1-9999-00005"></tr>
      <tr data-gtldresult-ac-id="44" data-tas-application-id="1-9999-00006"></tr>
    `;
    const { rows, quarantinedBlocks } = parseViewstatusGridHtml(html);
    expect(rows).toHaveLength(1);
    expect(quarantinedBlocks.length).toBeGreaterThan(0);
  });

  it("quarantines missing detail link and missing Application ID blocks", () => {
    const html = `
      <tr data-gtldresult-ac-id="55"><td>no app id</td></tr>
      <tr data-tas-application-id="1-9999-00007"><td>no ac</td></tr>
    `;
    const { rows, quarantinedBlocks } = parseViewstatusGridHtml(html);
    expect(rows).toHaveLength(0);
    expect(quarantinedBlocks).toHaveLength(2);
  });

  it("quarantines conflicting ac id sources within one block", () => {
    const html = `
      <tr data-gtldresult-ac-id="60" data-tas-application-id="1-9999-00008">
        <a href="/applicationstatus/viewapplicationdetails/61">Details</a>
      </tr>
    `;
    const { rows, quarantinedBlocks } = parseViewstatusGridHtml(html);
    expect(rows).toHaveLength(0);
    expect(quarantinedBlocks[0]?.reason).toContain("conflicting");
  });

  it("never infers ac id from Application ID numeric segments", () => {
    const html = `
      <tr>
        Application ID: <span>1-1311-58570</span>
      </tr>
    `;
    const { rows } = parseViewstatusGridHtml(html);
    expect(rows).toHaveLength(0);
  });

  it("parses committed synthetic fixture with artificial test ids only", async () => {
    const html = await readFile(defaultSyntheticGridParserFixturePath(workspaceRoot), "utf8");
    const map = mergeGridRowsIntoMapping(parseViewstatusGridHtml(html).rows);
    expect(map.get("1-1945-29108")).toBe(170);
    expect(map.get("1-9999-00001")).toBe(9001);
    expect(map.has("1-1311-58570")).toBe(false);
  });

  it("mapping dry-run default does not load synthetic fixture as evidence", async () => {
    const result = await runMappingDryRun({ workspaceRoot });
    expect(result.manifestResolved).toBe(1);
    expect(result.unresolvedApplicationIds).toHaveLength(24);
    expect(result.gridRowsParsed).toBe(0);
    expect(result.resolved.find((r) => r.applicationId === "1-1311-58570")?.gtldresultAcId).toBeNull();
    expect(result.resolved.find((r) => r.applicationId === "1-1945-29108")?.source).toBe("manifest");
  });
});
