import type { ViewstatusGridRow } from "./types";

const DETAIL_LINK_PATTERN =
  /viewapplicationdetails\/(\d+)|viewstatus:viewapplicationdetails\/(\d+)/gi;
const LABELED_APPLICATION_ID_PATTERN = /Application ID:[\s\S]{0,160}?(1-\d+-\d+)/gi;
const DATA_TAS_APPLICATION_ID_PATTERN = /data-tas-application-id="(1-\d+-\d+)"/gi;
const DATA_AC_ID_PATTERN = /data-gtldresult-ac-id="(\d+)"/gi;

const TR_BLOCK_PATTERN = /<tr\b[\s\S]*?<\/tr>/gi;
const EXPANDED_DIV_PATTERN =
  /<div\b[^>]*class="[^"]*\bexpanded\b[^"]*"[\s\S]*?<\/div>/gi;

export interface ViewstatusGridQuarantine {
  blockIndex: number;
  blockPreview: string;
  reason: string;
}

export interface ViewstatusGridParseResult {
  rows: ViewstatusGridRow[];
  quarantinedBlocks: ViewstatusGridQuarantine[];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)];
}

function collectDetailLinkAcIds(block: string): number[] {
  const ids: number[] = [];
  DETAIL_LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DETAIL_LINK_PATTERN.exec(block)) !== null) {
    const id = Number(match[1] ?? match[2]);
    if (!Number.isNaN(id)) ids.push(id);
  }
  return ids;
}

function collectApplicationIds(block: string): string[] {
  const ids: string[] = [];
  for (const pattern of [
    DATA_TAS_APPLICATION_ID_PATTERN,
    LABELED_APPLICATION_ID_PATTERN,
  ]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(block)) !== null) {
      ids.push(match[1]);
    }
  }
  return uniqueStrings(ids);
}

function collectDataAttributeAcIds(block: string): number[] {
  const ids: number[] = [];
  DATA_AC_ID_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DATA_AC_ID_PATTERN.exec(block)) !== null) {
    ids.push(Number(match[1]));
  }
  return ids;
}

function extractHtmlBlocks(html: string): string[] {
  const blocks: string[] = [];
  for (const pattern of [TR_BLOCK_PATTERN, EXPANDED_DIV_PATTERN]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      blocks.push(match[0]);
    }
  }
  return blocks;
}

function parseBoundedBlock(block: string, blockIndex: number): {
  row?: ViewstatusGridRow;
  quarantine?: ViewstatusGridQuarantine;
} {
  const applicationIds = collectApplicationIds(block);
  const linkAcIds = collectDetailLinkAcIds(block);
  const dataAcIds = collectDataAttributeAcIds(block);
  const acCandidates = uniqueNumbers([...linkAcIds, ...dataAcIds]);

  const preview = block.replace(/\s+/g, " ").trim().slice(0, 120);

  if (applicationIds.length === 0) {
    return {
      quarantine: {
        blockIndex,
        blockPreview: preview,
        reason: "missing Application ID in grid block",
      },
    };
  }
  if (applicationIds.length > 1) {
    return {
      quarantine: {
        blockIndex,
        blockPreview: preview,
        reason: `multiple Application IDs in one block: ${applicationIds.join(", ")}`,
      },
    };
  }
  if (acCandidates.length === 0) {
    return {
      quarantine: {
        blockIndex,
        blockPreview: preview,
        reason: "missing viewapplicationdetails link or data-gtldresult-ac-id in grid block",
      },
    };
  }
  if (acCandidates.length > 1) {
    return {
      quarantine: {
        blockIndex,
        blockPreview: preview,
        reason: `conflicting gtldresultAcId values in one block: ${acCandidates.join(", ")}`,
      },
    };
  }

  const tasApplicationId = applicationIds[0];
  const gtldresultAcId = acCandidates[0];

  // Never treat numeric segments of Application ID as AC id — only explicit block fields above.

  return {
    row: { gtldresultAcId, tasApplicationId },
  };
}

/**
 * Parse Apache Tapestry viewstatus grid HTML for Application ID ↔ gtldresultAcId pairs.
 * Each `<tr>` or expanded detail block is a bounded unit; document-order pairing is forbidden.
 */
export function parseViewstatusGridHtml(html: string): ViewstatusGridParseResult {
  const blocks = extractHtmlBlocks(html);
  const rows: ViewstatusGridRow[] = [];
  const quarantinedBlocks: ViewstatusGridQuarantine[] = [];
  const seenAc = new Set<number>();
  const seenApp = new Set<string>();

  blocks.forEach((block, blockIndex) => {
    const parsed = parseBoundedBlock(block, blockIndex);
    if (parsed.quarantine) {
      quarantinedBlocks.push(parsed.quarantine);
      return;
    }
    const row = parsed.row!;
    if (seenAc.has(row.gtldresultAcId) || seenApp.has(row.tasApplicationId)) {
      quarantinedBlocks.push({
        blockIndex,
        blockPreview: block.replace(/\s+/g, " ").trim().slice(0, 120),
        reason: `duplicate grid row for Application ID ${row.tasApplicationId} or ac ${row.gtldresultAcId}`,
      });
      return;
    }
    seenAc.add(row.gtldresultAcId);
    seenApp.add(row.tasApplicationId);
    rows.push(row);
  });

  return { rows, quarantinedBlocks };
}

export function mergeGridRowsIntoMapping(
  rows: ViewstatusGridRow[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (map.has(row.tasApplicationId) && map.get(row.tasApplicationId) !== row.gtldresultAcId) {
      throw new Error(
        `Duplicate Application ID in grid parse: ${row.tasApplicationId}`,
      );
    }
    map.set(row.tasApplicationId, row.gtldresultAcId);
  }
  return map;
}
