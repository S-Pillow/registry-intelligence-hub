import { parseRfc4180Csv } from "./csv";
import { matchSchemaProfile } from "./schema-profiles";
import type { SchemaProfileId } from "./types";

export type ParsedTransactionsTable = {
  schemaProfileId: SchemaProfileId;
  headers: string[];
  rows: Record<string, string>[];
};

export type ParseFailure = {
  outcome: "PARSE_FAILED" | "UNSUPPORTED_SCHEMA";
  error: string;
};

export function parseTransactionsCsv(
  text: string,
): { ok: true; table: ParsedTransactionsTable } | { ok: false; failure: ParseFailure } {
  let matrix: string[][];
  try {
    matrix = parseRfc4180Csv(text);
  } catch (e) {
    return {
      ok: false,
      failure: { outcome: "PARSE_FAILED", error: `CSV parse error: ${(e as Error).message}` },
    };
  }
  // Drop trailing empty rows
  while (matrix.length > 0) {
    const last = matrix[matrix.length - 1]!;
    if (last.length === 0 || (last.length === 1 && last[0] === "")) {
      matrix.pop();
      continue;
    }
    break;
  }
  if (matrix.length < 1) {
    return { ok: false, failure: { outcome: "PARSE_FAILED", error: "Empty CSV" } };
  }
  const headers = matrix[0]!.map((h) => h.trim());
  const profile = matchSchemaProfile(headers);
  if (!profile.ok) {
    return {
      ok: false,
      failure: { outcome: "UNSUPPORTED_SCHEMA", error: profile.reason },
    };
  }
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r]!;
    if (cells.every((c) => c.trim() === "")) continue;
    if (cells.length !== headers.length) {
      return {
        ok: false,
        failure: {
          outcome: "PARSE_FAILED",
          error: `Row ${r + 1} has ${cells.length} fields; expected ${headers.length}`,
        },
      };
    }
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]!] = cells[i]!;
    }
    rows.push(obj);
  }
  return {
    ok: true,
    table: { schemaProfileId: profile.profile.id, headers, rows },
  };
}

/** Extract TLD + YYYYMM from Spec 3 / CDN filename. */
export function parseTransactionsFilename(
  filenameOrUrl: string,
): { tldAsciiLabel: string; compactPeriod: string } | null {
  const base = filenameOrUrl.split("/").pop() ?? filenameOrUrl;
  const m = /^([a-z0-9-]+)-transactions-(\d{6})(?:-en)?\.csv$/i.exec(base);
  if (!m) return null;
  return { tldAsciiLabel: m[1]!.toLowerCase(), compactPeriod: m[2]! };
}
