import {
  APS_APPLICATION_CSV_ARTIFACT_ROLE,
  APS_APPLICATION_CSV_NORMALIZER_VERSION,
  APS_APPLICATION_CSV_PARSER_VERSION,
  APS_APPLICATION_CSV_REQUIRED_HEADERS,
  type ApplicationDesignationsV2,
  type ApplicationLabelsV2,
  type AppliedStringV2,
  type Registry2026ApplicationV2,
  type ReplacementStringV2,
} from "./publication-v2-types";

export type ApsCsvSourceRow = {
  sourceRowId: string;
  applicationType: string;
  applicant: string;
  primaryString: string;
  unicodeLabel: string;
  tldVariants: string;
  applicationStatus: string;
  processingStage: string;
  priority: string;
  country: string;
  region: string;
  designations: ApplicationDesignationsV2;
  labels: ApplicationLabelsV2;
  isReplacement: boolean;
};

export type ApsApplicationCsvParseResult = {
  artifactRole: typeof APS_APPLICATION_CSV_ARTIFACT_ROLE;
  parserVersion: typeof APS_APPLICATION_CSV_PARSER_VERSION;
  normalizerVersion: typeof APS_APPLICATION_CSV_NORMALIZER_VERSION;
  sourceRowCount: number;
  sourceRows: ApsCsvSourceRow[];
  applications: Registry2026ApplicationV2[];
  replacementCount: number;
  observedDistinctApplicantNames: number;
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

function parseApsBoolean(raw: string, column: string, sourceRowId: string): boolean {
  if (raw === "TRUE") return true;
  if (raw === "FALSE") return false;
  throw new Error(`APS CSV row ${sourceRowId}: column "${column}" must be TRUE or FALSE, got ${JSON.stringify(raw)}`);
}

function optionalNonEmpty(raw: string): string | undefined {
  return raw.length > 0 ? raw : undefined;
}

function assertApplicationHeaders(headers: string[]): void {
  if (headers.length !== APS_APPLICATION_CSV_REQUIRED_HEADERS.length) {
    throw new Error(
      `APS Application CSV header count ${headers.length} != ${APS_APPLICATION_CSV_REQUIRED_HEADERS.length}`,
    );
  }
  for (let i = 0; i < APS_APPLICATION_CSV_REQUIRED_HEADERS.length; i++) {
    if (headers[i] !== APS_APPLICATION_CSV_REQUIRED_HEADERS[i]) {
      throw new Error(
        `APS Application CSV header mismatch at index ${i}: expected ${JSON.stringify(APS_APPLICATION_CSV_REQUIRED_HEADERS[i])}, got ${JSON.stringify(headers[i])}`,
      );
    }
  }
}

function rejectContentionCsvShape(headers: string[]): void {
  const joined = headers.join(",");
  if (
    headers.length === 4
    && headers[0] === "#"
    && headers[1] === "Application ID"
    && headers[2] === "Org Name"
    && headers[3] === "Applied-for string(s)"
  ) {
    throw new Error("APS Application CSV parser rejected contention CSV shape");
  }
  if (joined.includes("Applied-for string(s)") && headers[0] === "#") {
    throw new Error("APS Application CSV parser rejected contention CSV shape");
  }
}

function rowToSource(headers: string[], cells: string[]): ApsCsvSourceRow {
  if (cells.length !== headers.length) {
    throw new Error(`APS CSV row column count ${cells.length} != header count ${headers.length}`);
  }
  const get = (name: string): string => cells[headers.indexOf(name)] ?? "";
  const sourceRowId = get("Application ID").trim();
  if (!sourceRowId) throw new Error("APS CSV row missing Application ID");
  const applicationType = get("Application Type").trim();
  // Replacement requires BOTH indicators; disagreement fails closed.
  const idEndsWithR = sourceRowId.endsWith("-R");
  const sourceTypeIsReplacement = applicationType === "Replacement String";
  if (idEndsWithR !== sourceTypeIsReplacement) {
    throw new Error(
      `APS CSV row ${sourceRowId}: replacement indicators disagree (idEndsWithR=${idEndsWithR}, applicationType=${JSON.stringify(applicationType)}); both -R suffix and Replacement String are required together`,
    );
  }
  const isReplacement = idEndsWithR && sourceTypeIsReplacement;
  const designations: ApplicationDesignationsV2 = {
    brand: parseApsBoolean(get("TLD Type: Brand"), "TLD Type: Brand", sourceRowId),
    community: parseApsBoolean(get("TLD Type: Community"), "TLD Type: Community", sourceRowId),
    geoSelfDesignated: parseApsBoolean(
      get("TLD Type: Geo (Self-Designated)"),
      "TLD Type: Geo (Self-Designated)",
      sourceRowId,
    ),
    geoStringReviewConfirmed: parseApsBoolean(
      get("TLD Type: Geo (String Review Confirmed)"),
      "TLD Type: Geo (String Review Confirmed)",
      sourceRowId,
    ),
    idn: parseApsBoolean(get("TLD Type: IDN"), "TLD Type: IDN", sourceRowId),
  };
  const labels: ApplicationLabelsV2 = {
    gacEarlyWarning: parseApsBoolean(get("Label: GAC Early Warning"), "Label: GAC Early Warning", sourceRowId),
    gacAdvice: parseApsBoolean(get("Label: GAC Advice"), "Label: GAC Advice", sourceRowId),
    highRiskString: parseApsBoolean(get("Label: High Risk String"), "Label: High Risk String", sourceRowId),
    objection: parseApsBoolean(get("Label: Objection"), "Label: Objection", sourceRowId),
    safeguard: parseApsBoolean(get("Label: Safeguard"), "Label: Safeguard", sourceRowId),
    inContentionExportLabel: parseApsBoolean(get("Label: In Contention"), "Label: In Contention", sourceRowId),
    clarifyingQuestions: parseApsBoolean(
      get("Label: Clarifying Questions"),
      "Label: Clarifying Questions",
      sourceRowId,
    ),
    changeRequest: parseApsBoolean(get("Label: Change Request"), "Label: Change Request", sourceRowId),
    openCommentPeriod: parseApsBoolean(get("Label: Open Comment Period"), "Label: Open Comment Period", sourceRowId),
    comments: parseApsBoolean(get("Label: Comments"), "Label: Comments", sourceRowId),
    rvc: parseApsBoolean(get("Label: RVC"), "Label: RVC", sourceRowId),
    applicantSupport: parseApsBoolean(get("Label: Applicant Support"), "Label: Applicant Support", sourceRowId),
    variantOnlyExistingTld: parseApsBoolean(
      get("Label: Variant Only (Existing TLD)"),
      "Label: Variant Only (Existing TLD)",
      sourceRowId,
    ),
    variantIncluded: parseApsBoolean(get("Label: Variant Included"), "Label: Variant Included", sourceRowId),
    cocExemption: parseApsBoolean(get("Label: CoC Exemption"), "Label: CoC Exemption", sourceRowId),
    reservedName: parseApsBoolean(get("Label: Reserved Name"), "Label: Reserved Name", sourceRowId),
    cpe: parseApsBoolean(get("Label: CPE"), "Label: CPE", sourceRowId),
    singularPlural: parseApsBoolean(get("Label: Singular/Plural"), "Label: Singular/Plural", sourceRowId),
  };
  return {
    sourceRowId,
    applicationType,
    applicant: get("Applicant Name").trim(),
    primaryString: get("Primary String").trim(),
    unicodeLabel: get("Primary String Unicode Label"),
    tldVariants: get("TLD Variants"),
    applicationStatus: get("Application Status").trim(),
    processingStage: get("Application Processing Stage").trim(),
    priority: get("Priority"),
    country: get("Location").trim(),
    region: get("Region").trim(),
    designations,
    labels,
    isReplacement,
  };
}

function toAppliedString(row: ApsCsvSourceRow): AppliedStringV2 {
  const applied: AppliedStringV2 = {
    sourceRowId: row.sourceRowId,
    label: row.primaryString,
  };
  const unicode = optionalNonEmpty(row.unicodeLabel);
  if (unicode !== undefined) applied.unicodeLabel = unicode;
  const variants = optionalNonEmpty(row.tldVariants);
  if (variants !== undefined) applied.tldVariants = variants;
  return applied;
}

function toReplacementString(row: ApsCsvSourceRow): ReplacementStringV2 {
  const replacement: ReplacementStringV2 = {
    sourceRowId: row.sourceRowId,
    label: row.primaryString,
    applicationStatus: row.applicationStatus,
    processingStage: row.processingStage,
    applicationType: row.applicationType,
  };
  const unicode = optionalNonEmpty(row.unicodeLabel);
  if (unicode !== undefined) replacement.unicodeLabel = unicode;
  const variants = optionalNonEmpty(row.tldVariants);
  if (variants !== undefined) replacement.tldVariants = variants;
  return replacement;
}

function baseApplicationFromRow(row: ApsCsvSourceRow): Registry2026ApplicationV2 {
  const app: Registry2026ApplicationV2 = {
    applicationId: row.sourceRowId,
    applicant: row.applicant,
    country: row.country,
    region: row.region,
    applicationStatus: row.applicationStatus,
    processingStage: row.processingStage,
    applicationType: row.applicationType,
    designations: row.designations,
    labels: row.labels,
    appliedString: toAppliedString(row),
  };
  if (row.priority.length > 0) app.priority = row.priority;
  return app;
}

/**
 * Parse + normalize APS Application export CSV bytes into logical Applications.
 * Fail-closed on contention CSV shape, header mismatch, duplicate IDs, unmatched -R.
 */
export function parseAndNormalizeApsApplicationCsv(bytes: Uint8Array): ApsApplicationCsvParseResult {
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rawRows = parseCsv(text);
  if (rawRows.length < 3) {
    throw new Error("APS Application CSV missing preamble/header structure");
  }

  // Expected: disclaimer row, blank row, header, then data.
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    if (rawRows[i][0] === "Priority" && rawRows[i].includes("Application ID")) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) {
    // Maybe contention or other CSV — check first row headers.
    if (rawRows[0]) rejectContentionCsvShape(rawRows[0]);
    throw new Error("APS Application CSV header row not found");
  }
  if (headerIndex < 2) {
    throw new Error("APS Application CSV preamble/header structure invalid");
  }

  const headers = rawRows[headerIndex];
  rejectContentionCsvShape(headers);
  assertApplicationHeaders(headers);

  const dataRows = rawRows.slice(headerIndex + 1).filter((r) => r.some((c) => c.length > 0));
  const sourceRows: ApsCsvSourceRow[] = [];
  const seenIds = new Set<string>();
  for (const cells of dataRows) {
    const row = rowToSource(headers, cells);
    if (seenIds.has(row.sourceRowId)) {
      throw new Error(`APS CSV duplicate Application ID: ${row.sourceRowId}`);
    }
    seenIds.add(row.sourceRowId);
    if (!row.applicant) throw new Error(`APS CSV row ${row.sourceRowId}: missing Applicant Name`);
    if (!row.primaryString) throw new Error(`APS CSV row ${row.sourceRowId}: missing Primary String`);
    sourceRows.push(row);
  }

  const byId = new Map(sourceRows.map((r) => [r.sourceRowId, r]));
  const baseRows = sourceRows.filter((r) => !r.isReplacement);
  const replacementRows = sourceRows.filter((r) => r.isReplacement);

  const applicationsById = new Map<string, Registry2026ApplicationV2>();
  for (const base of baseRows) {
    applicationsById.set(base.sourceRowId, baseApplicationFromRow(base));
  }

  for (const repl of replacementRows) {
    const baseId = repl.sourceRowId.slice(0, -2);
    if (baseId.endsWith("-R")) {
      throw new Error(`APS CSV replacement ${repl.sourceRowId}: unsupported double -R`);
    }
    const base = byId.get(baseId);
    if (!base || base.isReplacement) {
      throw new Error(`APS CSV unmatched replacement source row: ${repl.sourceRowId}`);
    }
    if (base.applicant !== repl.applicant) {
      throw new Error(
        `APS CSV replacement ${repl.sourceRowId}: applicant mismatch with base ${baseId}`,
      );
    }
    const app = applicationsById.get(baseId);
    if (!app) throw new Error(`APS CSV internal error: missing application for ${baseId}`);
    if (app.replacementString) {
      throw new Error(`APS CSV application ${baseId}: multiple replacement rows`);
    }
    app.replacementString = toReplacementString(repl);
  }

  const applications = [...applicationsById.values()].sort((a, b) =>
    a.applicationId.localeCompare(b.applicationId)
  );
  const observedDistinctApplicantNames = new Set(applications.map((a) => a.applicant)).size;

  return {
    artifactRole: APS_APPLICATION_CSV_ARTIFACT_ROLE,
    parserVersion: APS_APPLICATION_CSV_PARSER_VERSION,
    normalizerVersion: APS_APPLICATION_CSV_NORMALIZER_VERSION,
    sourceRowCount: sourceRows.length,
    sourceRows,
    applications,
    replacementCount: replacementRows.length,
    observedDistinctApplicantNames,
  };
}

/** Role-gated entry — never register as unrestricted text/csv CapturedArtifactParser. */
export function parseApsApplicationExportArtifact(args: {
  artifactRole: string;
  mediaType: string;
  bytes: Uint8Array;
}): ApsApplicationCsvParseResult {
  if (args.artifactRole !== APS_APPLICATION_CSV_ARTIFACT_ROLE) {
    throw new Error(`Unsupported artifact role for APS Application CSV: ${args.artifactRole}`);
  }
  if (args.mediaType !== "text/csv" && args.mediaType !== "text/csv;charset=UTF-8") {
    throw new Error(`APS Application CSV expects media type text/csv, got ${args.mediaType}`);
  }
  return parseAndNormalizeApsApplicationCsv(args.bytes);
}
