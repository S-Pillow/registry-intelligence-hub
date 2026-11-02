import { describe, expect, it } from "vitest";
import {
  extractHistoricalRspEvidenceFromPublicPortionHtml,
} from "./q23-evidence-extractor";
import {
  findQ23SectionMatch,
  findQ23SectionStart,
  portionDocumentHasQ23Section,
} from "./q23-section-recognition";
import { validatePublicPortionDocument } from "./public-portion-validation";

const APP_ID = "1-0000-00000";
const CANONICAL_PROMPT =
  "23. Provide name and full description of all the Registry Services to be provided";

function shell(body: string, applicationId = APP_ID): string {
  return `<!DOCTYPE html><html><body>
<p>Application ID: ${applicationId}</p>
${body}
</body></html>`;
}

describe("RIH-2012-RSP-VISIBILITY-1H4 — Q23 section recognition", () => {
  describe("positive — existing A/B/C forms", () => {
    it("recognizes id=q23", () => {
      const html = shell(`<div id="q23"><p>Synthetic Q23 body.</p></div>`);
      expect(portionDocumentHasQ23Section(html)).toBe(true);
      expect(findQ23SectionMatch(html)?.kind).toBe("dom-id");
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );
    });

    it("recognizes id=q23_agb", () => {
      const html = shell(`<div id="q23_agb"><p>Synthetic Q23 body.</p></div>`);
      expect(portionDocumentHasQ23Section(html)).toBe(true);
      expect(findQ23SectionMatch(html)?.kind).toBe("dom-id");
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );
    });

    it("recognizes Question 23 … Registry Services", () => {
      const html = shell(`<h2>Question 23 - Registry Services</h2><p>Body.</p>`);
      expect(portionDocumentHasQ23Section(html)).toBe(true);
      expect(findQ23SectionMatch(html)?.kind).toBe("heading");
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );
    });

    it("recognizes 23. Registry Services", () => {
      const html = shell(`<h2>23. Registry Services</h2><p>Body.</p>`);
      expect(portionDocumentHasQ23Section(html)).toBe(true);
      expect(findQ23SectionMatch(html)?.kind).toBe("heading");
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );
    });

    it("recognizes defined-phrase form", () => {
      const html = shell(
        `<p>Registry services are defined as the following: synthetic operations.</p>`,
      );
      expect(portionDocumentHasQ23Section(html)).toBe(true);
      expect(findQ23SectionMatch(html)?.kind).toBe("defined-phrase");
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );
    });
  });

  describe("positive — canonical ICANN prompt", () => {
    it("recognizes the exact canonical prompt", () => {
      const html = shell(`<p>Registry Services</p><p>${CANONICAL_PROMPT}</p><p>Synthetic body.</p>`);
      expect(portionDocumentHasQ23Section(html)).toBe(true);
      expect(findQ23SectionMatch(html)?.kind).toBe("canonical-prompt");
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );
    });

    it("recognizes the canonical prompt with extra whitespace/newlines", () => {
      const html = shell(`<p>23.\n  Provide   name\nand\tfull description of all the Registry Services to be provided</p>`);
      expect(portionDocumentHasQ23Section(html)).toBe(true);
      expect(findQ23SectionMatch(html)?.kind).toBe("canonical-prompt");
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );
    });

    it("recognizes the canonical prompt split by nested formatting tags", () => {
      const html = shell(
        `<p>23. <b>Provide</b> name and <i>full</i> description of all the <span>Registry</span> Services to be provided</p>`,
      );
      expect(portionDocumentHasQ23Section(html)).toBe(true);
      expect(findQ23SectionMatch(html)?.kind).toBe("canonical-prompt");
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );
    });

    it("recognizes the canonical prompt between Q22 and Q24 and isolates before Q24", () => {
      const html = shell(`
        <h2>22. Protection of Geographic Names</h2>
        <p>Synthetic Q22 body.</p>
        <p>Registry Services</p>
        <p>${CANONICAL_PROMPT}</p>
        <p>SYNTHETIC_Q23_ONLY</p>
        <div id="q24"><h2>24. Shared Registration System</h2><p>MARKER_Q24_ONLY</p></div>
      `);
      expect(portionDocumentHasQ23Section(html)).toBe(true);
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );

      const q23Start = findQ23SectionStart(html);
      expect(q23Start).toBeGreaterThanOrEqual(0);
      const q24Match = /id\s*=\s*["']q24(?:_agb)?["']/i.exec(html);
      expect(q24Match).not.toBeNull();
      const q24Gt = html.indexOf(">", q24Match!.index);
      const q24Start = q24Gt >= 0 ? q24Gt + 1 : q24Match!.index;
      expect(q24Start).toBeGreaterThan(q23Start);

      const q23Slice = html.slice(q23Start, q24Start);
      expect(q23Slice).toContain("Provide name and full description");
      expect(q23Slice).toContain("SYNTHETIC_Q23_ONLY");
      expect(q23Slice).not.toContain("MARKER_Q24_ONLY");

      const extraction = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
        expectedApplicationId: APP_ID,
      });
      expect(extraction.disposition).not.toBe("UNSUPPORTED_OR_MISSING_Q23_BASIS");
      expect(extraction.applicationId).toBe(APP_ID);
      // No provider assertion grammar in this synthetic body.
      expect(extraction.disposition).toBe("NO_QUALIFYING_PROVIDER_ASSERTION");
      expect(extraction.candidates).toEqual([]);
    });

    it("does not require a separate Q23 Registry Services matcher when the prompt is present", () => {
      const html = shell(`
        <p>Q23 Registry Services</p>
        <p>${CANONICAL_PROMPT}</p>
      `);
      const match = findQ23SectionMatch(html);
      expect(match?.kind).toBe("canonical-prompt");
      expect(portionDocumentHasQ23Section(html)).toBe(true);
    });
  });

  describe("negative — must remain fail-closed", () => {
    it("rejects prose that only mentions Registry Services", () => {
      const html = shell(`<p>The applicant discusses Registry Services generally.</p>`);
      expect(portionDocumentHasQ23Section(html)).toBe(false);
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        false,
      );
    });

    it("rejects an unrelated sentence containing 23", () => {
      const html = shell(`<p>See figure 23 for the topology diagram.</p>`);
      expect(portionDocumentHasQ23Section(html)).toBe(false);
    });

    it("rejects Question 23 without Registry Services or the canonical prompt", () => {
      const html = shell(`<h2>Question 23</h2><p>Unrelated content.</p>`);
      expect(portionDocumentHasQ23Section(html)).toBe(false);
    });

    it("rejects Q22 followed directly by Q24", () => {
      const html = shell(`
        <h2>22. Protection of Geographic Names</h2>
        <div id="q24"><h2>24. Shared Registration System</h2></div>
      `);
      expect(portionDocumentHasQ23Section(html)).toBe(false);
      expect(
        validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok,
      ).toBe(false);
    });

    it("rejects application-details pages with download link but no Q23", () => {
      const html = `<html><body>
        Application ID: ${APP_ID}
        <a href="/applicationstatus/applicationdetails:downloadapplication/1?t:ac=1">Download public portion of application</a>
      </body></html>`;
      const result = validatePublicPortionDocument(html, { expectedApplicationId: APP_ID });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("incomplete-portion-q23");
    });

    it("rejects status-grid pages even if they mention q23 textually", () => {
      const html = `<html><body>
        Displaying 1 - 35 of 1930
        <a href="/applicationstatus/viewstatus.statusgrid.pager/2">2</a>
        <div id="q23">not a portion</div>
      </body></html>`;
      const result = validatePublicPortionDocument(html);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("incomplete-portion-q23");
    });

    it("rejects ICANN error pages", () => {
      const html = `<html><head><title>ICANN Error</title></head><body><h1>ICANN Error</h1>
        <p>23. Provide name and full description of all the Registry Services to be provided</p>
      </body></html>`;
      const result = validatePublicPortionDocument(html);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("incomplete-portion-q23");
    });

    it("ignores canonical prompt text inside script/style blocks", () => {
      const html = shell(`
        <script>var x = "${CANONICAL_PROMPT}";</script>
        <style>/* ${CANONICAL_PROMPT} */</style>
        <p>No real Q23 section in document body.</p>
      `);
      expect(portionDocumentHasQ23Section(html)).toBe(false);
      expect(findQ23SectionStart(html)).toBe(-1);
    });

    it("does not treat bare Q23 Registry Services as sufficient without the prompt", () => {
      const html = shell(`<p>Q23 Registry Services</p><p>Synthetic narrative without the prompt.</p>`);
      expect(portionDocumentHasQ23Section(html)).toBe(false);
    });
  });

  describe("excluded-match continuation (1H4-R1)", () => {
    it("finds a body canonical prompt after an excluded script occurrence", () => {
      const bodyPrompt = `<p id="body-q23">${CANONICAL_PROMPT}</p><p>SYNTHETIC_Q23_BODY</p>`;
      const html = shell(`
        <script>var decoy = "${CANONICAL_PROMPT}";</script>
        ${bodyPrompt}
        <div id="q24"><h2>24. Shared Registration System</h2><p>MARKER_Q24_ONLY</p></div>
      `);
      const match = findQ23SectionMatch(html);
      expect(match).not.toBeNull();
      expect(match!.kind).toBe("canonical-prompt");
      expect(html.slice(match!.index, match!.index + 40)).toContain("23.");
      expect(match!.index).toBeGreaterThan(html.indexOf("</script>"));
      expect(html.slice(0, match!.index)).toContain("<script>");
      expect(portionDocumentHasQ23Section(html)).toBe(true);
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );

      const q24 = /id\s*=\s*["']q24(?:_agb)?["']/i.exec(html)!;
      const q24Start = html.indexOf(">", q24.index) + 1;
      const slice = html.slice(match!.index, q24Start);
      expect(slice).toContain("SYNTHETIC_Q23_BODY");
      expect(slice).not.toContain("MARKER_Q24_ONLY");

      const extraction = extractHistoricalRspEvidenceFromPublicPortionHtml(html, {
        expectedApplicationId: APP_ID,
      });
      expect(extraction.disposition).toBe("NO_QUALIFYING_PROVIDER_ASSERTION");
      expect(extraction.candidates).toEqual([]);
    });

    it("finds a body canonical prompt after an excluded style occurrence", () => {
      const html = shell(`
        <style>/* ${CANONICAL_PROMPT} */</style>
        <p>${CANONICAL_PROMPT}</p>
      `);
      const match = findQ23SectionMatch(html);
      expect(match?.kind).toBe("canonical-prompt");
      expect(match!.index).toBeGreaterThan(html.indexOf("</style>"));
      expect(portionDocumentHasQ23Section(html)).toBe(true);
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );
    });

    it("finds a real DOM id after script text containing id=\"q23\"", () => {
      const html = shell(`
        <script>var attr = 'id="q23"';</script>
        <div id="q23"><p>SYNTHETIC_DOM_Q23</p></div>
      `);
      const match = findQ23SectionMatch(html);
      expect(match?.kind).toBe("dom-id");
      expect(match!.index).toBeGreaterThan(html.indexOf("</script>"));
      expect(html.slice(match!.index)).toContain("SYNTHETIC_DOM_Q23");
      expect(validatePublicPortionDocument(html, { expectedApplicationId: APP_ID }).ok).toBe(
        true,
      );
    });

    it("still rejects script-only and style-only canonical prompts", () => {
      const scriptOnly = shell(`<script>var x = "${CANONICAL_PROMPT}";</script><p>No body Q23.</p>`);
      expect(portionDocumentHasQ23Section(scriptOnly)).toBe(false);
      expect(findQ23SectionStart(scriptOnly)).toBe(-1);

      const styleOnly = shell(`<style>/* ${CANONICAL_PROMPT} */</style><p>No body Q23.</p>`);
      expect(portionDocumentHasQ23Section(styleOnly)).toBe(false);
      expect(findQ23SectionStart(styleOnly)).toBe(-1);
    });

    it("selects the earliest valid cross-pattern match after an excluded decoy", () => {
      const html = shell(`
        <script>var decoy = "${CANONICAL_PROMPT}";</script>
        <h2>23. Registry Services</h2>
        <p>HEADING_BODY</p>
        <p>${CANONICAL_PROMPT}</p>
        <p>LATER_CANONICAL_BODY</p>
      `);
      const match = findQ23SectionMatch(html);
      expect(match?.kind).toBe("heading");
      expect(match!.index).toBeGreaterThan(html.indexOf("</script>"));
      expect(html.slice(match!.index)).toContain("HEADING_BODY");
      // Heading precedes the later body canonical prompt.
      expect(match!.index).toBeLessThan(html.indexOf(CANONICAL_PROMPT, html.indexOf("</script>")));
    });
  });
});
