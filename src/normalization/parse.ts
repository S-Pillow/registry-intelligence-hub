import { contentHash } from "./hashes";
import type { LoadedFixtureBundle } from "./load-bundle";
import { PARSER_VERSION, type ParsedRecord, type RawSnapshotRef, type RecordLocator } from "./types";

function parseApplicationFile(
  bundleId: string,
  sourceFile: string,
  lines: LoadedFixtureBundle["applicationLinesPrimary"],
  rawSnapshotRef: RawSnapshotRef,
  recordType = "application-row",
): ParsedRecord[] {
  const parsedAt = "2012-06-13T12:00:00.000Z";
  return lines.map((line) => {
    const locator: RecordLocator = {
      bundleId,
      sourceFile,
      lineNumber: line.lineNumber,
      recordKey: String(line.parsed.recordKey),
    };
    const payload = { ...line.parsed };
    const record: ParsedRecord = {
      parserVersion: PARSER_VERSION,
      locator,
      recordType,
      contentHash: contentHash({ parserVersion: PARSER_VERSION, locator, payload }),
      rawSnapshotRef,
      parsedAt,
      payload,
    };
    return record;
  });
}

export function parseBundle(loaded: LoadedFixtureBundle): ParsedRecord[] {
  const [primarySnap, secondarySnap] = loaded.rawSnapshots;
  const primarySourceFile =
    loaded.applicationFormat === "reveal-day-csv"
      ? "sources/strings-1200utc-13jun12-en.csv"
      : "applications.jsonl";
  const primary = parseApplicationFile(
    loaded.definition.id,
    primarySourceFile,
    loaded.applicationLinesPrimary,
    primarySnap,
    loaded.applicationFormat === "reveal-day-csv" ? "reveal-day-application-row" : "application-row",
  );
  const secondary =
    loaded.applicationLinesSecondary.length > 0
      ? parseApplicationFile(
          loaded.definition.id,
          "secondary-applications.jsonl",
          loaded.applicationLinesSecondary,
          secondarySnap ?? primarySnap,
        )
      : [];

  const parsedAt = "2012-06-13T12:00:00.000Z";
  const contentionSnap = loaded.rawSnapshots[1] ?? primarySnap;
  const contentionRecords: ParsedRecord[] = loaded.contentionSets.sets.map((set, index) => {
    const locator: RecordLocator = {
      bundleId: loaded.definition.id,
      sourceFile: "contention-sets.json",
      lineNumber: index + 1,
      recordKey: String(set.setId),
    };
    return {
      parserVersion: PARSER_VERSION,
      locator,
      recordType: "contention-set",
      contentHash: contentHash({ parserVersion: PARSER_VERSION, locator, payload: set }),
      rawSnapshotRef: contentionSnap,
      parsedAt,
      payload: set,
    };
  });

  const operatorRecords: ParsedRecord[] = loaded.registryOperators.operators.map((op, index) => {
    const locator: RecordLocator = {
      bundleId: loaded.definition.id,
      sourceFile: "registry-operators.json",
      lineNumber: index + 1,
      recordKey: String(op.operatorId),
    };
    return {
      parserVersion: PARSER_VERSION,
      locator,
      recordType: "registry-operator",
      contentHash: contentHash({ parserVersion: PARSER_VERSION, locator, payload: op }),
      rawSnapshotRef: primarySnap,
      parsedAt,
      payload: op,
    };
  });

  return [...primary, ...secondary, ...contentionRecords, ...operatorRecords];
}
