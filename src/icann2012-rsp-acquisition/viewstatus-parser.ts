import type { ViewstatusGridRow } from "./types";

/**
 * Parse Apache Tapestry viewstatus grid HTML for Application ID ↔ gtldresultAcId pairs.
 * Tolerates committed fixture snippets and synthetic test rows.
 */
export function parseViewstatusGridHtml(html: string): ViewstatusGridRow[] {
  const rows: ViewstatusGridRow[] = [];
  const seenAc = new Set<number>();
  const seenApp = new Set<string>();

  const pushRow = (gtldresultAcId: number, tasApplicationId: string) => {
    if (seenAc.has(gtldresultAcId) || seenApp.has(tasApplicationId)) return;
    seenAc.add(gtldresultAcId);
    seenApp.add(tasApplicationId);
    rows.push({ gtldresultAcId, tasApplicationId });
  };

  const detailLinkPattern =
    /viewapplicationdetails\/(\d+)|viewstatus:viewapplicationdetails\/(\d+)/gi;
  const acIds: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = detailLinkPattern.exec(html)) !== null) {
    const id = Number(match[1] ?? match[2]);
    if (!Number.isNaN(id)) acIds.push(id);
  }

  const appIdPattern = /Application ID:[\s\S]{0,120}?(1-\d+-\d+)/gi;
  const applicationIds: string[] = [];
  while ((match = appIdPattern.exec(html)) !== null) {
    applicationIds.push(match[1]);
  }

  // Alternate compact fixture format: data attributes on synthetic rows.
  const syntheticPattern =
    /data-gtldresult-ac-id="(\d+)"[^>]*data-tas-application-id="(1-\d+-\d+)"/gi;
  while ((match = syntheticPattern.exec(html)) !== null) {
    pushRow(Number(match[1]), match[2]);
  }

  const pairCount = Math.min(acIds.length, applicationIds.length);
  for (let i = 0; i < pairCount; i++) {
    pushRow(acIds[i], applicationIds[i]);
  }

  // If only ac ids with separate blocks, pair by order of first occurrence in document.
  if (acIds.length > 0 && applicationIds.length === 0) {
    const blockAppIds = [...html.matchAll(/tasApplicationId[^0-9]*(1-\d+-\d+)/gi)].map((m) => m[1]);
    const ids = blockAppIds.length > 0 ? blockAppIds : applicationIds;
    for (let i = 0; i < Math.min(acIds.length, ids.length); i++) {
      pushRow(acIds[i], ids[i]);
    }
  }

  return rows;
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
