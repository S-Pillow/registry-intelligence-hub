/**
 * Parse ICANN Reveal Day 13 Jun 2012 strings CSV (14 columns, UTF-8).
 * Preserves raw column names on the parsed payload for lineage; normalization maps a parity subset.
 */

export interface RevealDayCsvRow {
  recordKey: string;
  applicationId: string;
  stringUlabel: string;
  stringAlabel: string | null;
  isIdn: boolean;
  applicantLegalName: string;
  applicantJurisdiction: string | null;
  /** Columns present in source but not normalized in this build. */
  preservedColumns: Record<string, string | null>;
}

const EXPECTED_HEADER = [
  "String",
  "Applicant",
  "Website",
  "Location",
  "Region",
  "Primary Contact",
  "Email",
  "IDN?",
  "A-Label",
  "English Meaning",
  "Script Code",
  "Community?",
  "Geographic?",
  "Application ID",
];

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function parseRevealDayCsvText(csvText: string): RevealDayCsvRow[] {
  const lines = csvText.split(/\r\n|\r|\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error("Reveal Day CSV must include a header row and at least one application");
  }

  const header = parseCsvLine(lines[0]);
  if (header.length !== EXPECTED_HEADER.length) {
    throw new Error(`Unexpected Reveal Day CSV column count: ${header.length} (expected ${EXPECTED_HEADER.length})`);
  }
  for (let i = 0; i < EXPECTED_HEADER.length; i++) {
    if (header[i] !== EXPECTED_HEADER[i]) {
      throw new Error(`Unexpected Reveal Day CSV header at column ${i + 1}: "${header[i]}"`);
    }
  }

  const rows: RevealDayCsvRow[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const cols = parseCsvLine(lines[lineIndex]);
    if (cols.length !== EXPECTED_HEADER.length) {
      throw new Error(`CSV row ${lineIndex + 1} has ${cols.length} columns`);
    }
    const [
      stringUlabel,
      applicant,
      website,
      location,
      region,
      primaryContact,
      email,
      idnFlag,
      aLabel,
      englishMeaning,
      scriptCode,
      community,
      geographic,
      applicationId,
    ] = cols;

    const idnNormalized = idnFlag.trim().toUpperCase();
    const isIdn = idnNormalized === "Y" || idnNormalized === "YES";
    rows.push({
      recordKey: `app-${applicationId}`,
      applicationId,
      stringUlabel,
      stringAlabel: (() => {
        const trimmed = aLabel.trim();
        if (!trimmed || trimmed === "--") return null;
        return trimmed;
      })(),
      isIdn,
      applicantLegalName: applicant,
      applicantJurisdiction: location.trim() ? location.trim() : null,
      preservedColumns: {
        Website: website.trim() ? website : null,
        Region: region.trim() ? region : null,
        "Primary Contact": primaryContact.trim() ? primaryContact : null,
        Email: email.trim() ? email : null,
        "English Meaning": englishMeaning.trim() ? englishMeaning : null,
        "Script Code": scriptCode.trim() ? scriptCode : null,
        "Community?": community.trim() ? community : null,
        "Geographic?": geographic.trim() ? geographic : null,
      },
    });
  }

  return rows;
}
