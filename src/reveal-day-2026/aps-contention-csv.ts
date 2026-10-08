import {
  APS_CONTENTION_CSV_ARTIFACT_ROLE,
  APS_CONTENTION_CSV_NORMALIZER_VERSION,
  APS_CONTENTION_CSV_PARSER_VERSION,
  APS_CONTENTION_CSV_REQUIRED_HEADERS,
  type ContentionMemberV1,
  type ContentionSetV1,
} from "./contention-membership-types";

export type ApsContentionCsvParseResult = {
  artifactRole: typeof APS_CONTENTION_CSV_ARTIFACT_ROLE;
  parserVersion: typeof APS_CONTENTION_CSV_PARSER_VERSION;
  normalizerVersion: typeof APS_CONTENTION_CSV_NORMALIZER_VERSION;
  sourceMembershipRowCount: number;
  contentionSets: ContentionSetV1[];
  replacementIdCount: number;
  applicationsAppearingInMultipleSets: number;
  wdoPresentInContentionSource: boolean;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rejectApplicationCsvShape(headers: string[]): void {
  if (headers[0] === "Priority" && headers.includes("Application ID")) {
    throw new Error("APS Contention CSV parser rejected Application CSV shape");
  }
  if (headers.includes("TLD Type: Brand") || headers.includes("Label: In Contention")) {
    throw new Error("APS Contention CSV parser rejected Application CSV shape");
  }
  // Real Application export also carries a preamble; if a Priority header appears later, still reject.
  if (headers.includes("Priority") && headers.includes("Applicant Name")) {
    throw new Error("APS Contention CSV parser rejected Application CSV shape");
  }
}

function assertContentionHeaders(headers: string[]): void {
  rejectApplicationCsvShape(headers);
  if (headers.length !== APS_CONTENTION_CSV_REQUIRED_HEADERS.length) {
    throw new Error(
      `APS Contention CSV header count ${headers.length} != ${APS_CONTENTION_CSV_REQUIRED_HEADERS.length}`,
    );
  }
  for (let i = 0; i < APS_CONTENTION_CSV_REQUIRED_HEADERS.length; i++) {
    if (headers[i] !== APS_CONTENTION_CSV_REQUIRED_HEADERS[i]) {
      throw new Error(
        `APS Contention CSV header mismatch at index ${i}: expected ${JSON.stringify(APS_CONTENTION_CSV_REQUIRED_HEADERS[i])}, got ${JSON.stringify(headers[i])}`,
      );
    }
  }
}

function isWellFormedSetId(value: string): boolean {
  return /^\d+$/.test(value) && Number.parseInt(value, 10) > 0;
}

/**
 * Parse Reveal Day contention CSV into official sets/members.
 * Fail-closed on Application CSV shape, bad headers, missing fields, -R IDs, duplicate memberships.
 */
export function parseAndNormalizeApsContentionCsv(bytes: Uint8Array): ApsContentionCsvParseResult {
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rawRows = parseCsv(text).filter((r) => r.some((c) => c.length > 0));
  if (rawRows.length < 2) {
    throw new Error("APS Contention CSV missing header/data structure");
  }

  const headers = rawRows[0];
  assertContentionHeaders(headers);

  const get = (cells: string[], name: string): string => cells[headers.indexOf(name)] ?? "";
  const membershipKeySeen = new Set<string>();
  const setsById = new Map<string, ContentionMemberV1[]>();
  const appToSets = new Map<string, Set<string>>();
  let replacementIdCount = 0;
  let wdoPresent = false;

  for (let i = 1; i < rawRows.length; i++) {
    const cells = rawRows[i];
    if (cells.length !== headers.length) {
      throw new Error(`APS Contention CSV row ${i}: column count ${cells.length} != ${headers.length}`);
    }
    const setId = get(cells, "#").trim();
    const applicationId = get(cells, "Application ID").trim();
    const publishedOrgName = get(cells, "Org Name");
    const appliedForStringsAsPublished = get(cells, "Applied-for string(s)");

    if (!setId) throw new Error(`APS Contention CSV row ${i}: missing set identifier (#)`);
    if (!isWellFormedSetId(setId)) {
      throw new Error(`APS Contention CSV row ${i}: malformed set identifier ${JSON.stringify(setId)}`);
    }
    if (!applicationId) throw new Error(`APS Contention CSV row ${i}: missing Application ID`);
    if (applicationId.endsWith("-R")) {
      replacementIdCount += 1;
      throw new Error(`APS Contention CSV row ${i}: replacement -R Application ID not allowed: ${applicationId}`);
    }
    if (applicationId === "WDO2627T-T45217") wdoPresent = true;

    const membershipKey = `${setId}\u0000${applicationId}`;
    if (membershipKeySeen.has(membershipKey)) {
      throw new Error(`APS Contention CSV duplicate membership: set ${setId} / ${applicationId}`);
    }
    membershipKeySeen.add(membershipKey);

    const member: ContentionMemberV1 = {
      applicationId,
      publishedOrgName,
      appliedForStringsAsPublished,
      sourceRowIndex: i,
    };
    const list = setsById.get(setId) ?? [];
    list.push(member);
    setsById.set(setId, list);

    const setIds = appToSets.get(applicationId) ?? new Set<string>();
    setIds.add(setId);
    appToSets.set(applicationId, setIds);
  }

  const contentionSets: ContentionSetV1[] = [...setsById.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0]))
    .map(([officialContentionSetId, members]) => ({
      officialContentionSetId,
      members: [...members].sort((a, b) => a.applicationId.localeCompare(b.applicationId)),
    }));

  const applicationsAppearingInMultipleSets = [...appToSets.values()].filter((s) => s.size > 1).length;

  return {
    artifactRole: APS_CONTENTION_CSV_ARTIFACT_ROLE,
    parserVersion: APS_CONTENTION_CSV_PARSER_VERSION,
    normalizerVersion: APS_CONTENTION_CSV_NORMALIZER_VERSION,
    sourceMembershipRowCount: membershipKeySeen.size,
    contentionSets,
    replacementIdCount,
    applicationsAppearingInMultipleSets,
    wdoPresentInContentionSource: wdoPresent,
  };
}

/** Role-gated entry — never register as unrestricted text/csv CapturedArtifactParser. */
export function parseApsContentionExportArtifact(args: {
  artifactRole: string;
  mediaType: string;
  bytes: Uint8Array;
}): ApsContentionCsvParseResult {
  if (args.artifactRole !== APS_CONTENTION_CSV_ARTIFACT_ROLE) {
    throw new Error(`Unsupported artifact role for APS Contention CSV: ${args.artifactRole}`);
  }
  if (args.mediaType !== "text/csv" && args.mediaType !== "text/csv;charset=UTF-8") {
    throw new Error(`APS Contention CSV expects media type text/csv, got ${args.mediaType}`);
  }
  return parseAndNormalizeApsContentionCsv(args.bytes);
}
