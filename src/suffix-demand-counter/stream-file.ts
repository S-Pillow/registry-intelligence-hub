import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Transform } from "node:stream";
import { createGunzip } from "node:zlib";
import type { SuffixMatcher } from "./suffix-matcher";
import { parseRegistrableDomainForTld } from "./parse-domain";
import { SuffixDemandCounterError, type FileVerification, type PanelFileSpec } from "./types";

type HeaderState = {
  generated: string | null;
  tld: string | null;
  domains: number | null;
  source: string | null;
  method: string | null;
};

export type StreamFileResult = {
  verification: FileVerification;
  /** Distinct FQDNs accepted from this file (for cross-checks / tests). */
  acceptedDomainCount: number;
};

/**
 * Stream a gzipped ActiveDNS list: hash compressed bytes, parse headers and
 * domain lines, update per-candidate distinct-FQDN counters.
 *
 * ActiveDNS files must be sorted by normalized registrable domain. We
 * retain only the previous accepted domain per file, rejecting out-of-order
 * records and suppressing adjacent duplicates. Separate TLDs stay distinct.
 */
export async function streamPanelFile(options: {
  absolutePath: string;
  spec: PanelFileSpec;
  snapshotDate: string;
  matcher: SuffixMatcher;
  matchCounts: Map<string, number>;
}): Promise<StreamFileResult> {
  const { absolutePath, spec, snapshotDate, matcher, matchCounts } = options;

  const hasher = new HashThrough();
  const gunzip = createGunzip();
  const input = createReadStream(absolutePath);

  let headerLines = 0;
  let acceptedRecords = 0;
  let rejectedRecords = 0;
  let duplicateRecords = 0;
  let bodyLines = 0;
  const header: HeaderState = {
    generated: null,
    tld: null,
    domains: null,
    source: null,
    method: null,
  };
  let sawBody = false;
  let previousDomain: string | null = null;

  const lineReader = createInterface({
    input: input.pipe(hasher).pipe(gunzip),
    crlfDelay: Infinity,
  });

  try {
    for await (const rawLine of lineReader) {
      const line = rawLine.replace(/\r$/, "");
      if (!line) {
        // Empty lines are not counted as ActiveDNS domain records.
        rejectedRecords += 1;
        continue;
      }
      if (line.startsWith("#")) {
        if (sawBody) {
          rejectedRecords += 1;
          continue;
        }
        headerLines += 1;
        applyHeaderLine(header, line);
        continue;
      }

      sawBody = true;
      bodyLines += 1;
      const parsed = parseRegistrableDomainForTld(line, spec.tld);
      if (!parsed) {
        rejectedRecords += 1;
        continue;
      }

      if (previousDomain !== null && parsed.domain < previousDomain) {
        throw new SuffixDemandCounterError(
          `Unsorted ActiveDNS input in ${spec.filename} at record ${bodyLines}`,
          [`previous=${previousDomain}`, `current=${parsed.domain}`],
        );
      }
      if (parsed.domain === previousDomain) {
        duplicateRecords += 1;
        continue;
      }
      previousDomain = parsed.domain;
      acceptedRecords += 1;
      matcher.countMatches(parsed.sld, matchCounts);
    }
  } catch (err) {
    throw new SuffixDemandCounterError(`Failed while reading ${spec.filename}`, [
      err instanceof Error ? err.message : String(err),
    ]);
  }

  const actualSha256 = hasher.digestHex();
  const headerTld = header.tld ? header.tld.replace(/^\./, "").toLowerCase() : null;
  const headerMetaOk =
    header.generated === snapshotDate &&
    headerTld === spec.tld.toLowerCase() &&
    header.domains === spec.declaredDomains &&
    bodyLines === spec.declaredDomains;

  const verification: FileVerification = {
    tld: spec.tld,
    filename: spec.filename,
    path: absolutePath,
    expectedSha256: spec.sha256,
    actualSha256,
    sha256Match: actualSha256 === spec.sha256.toLowerCase(),
    expectedDeclaredDomains: spec.declaredDomains,
    headerGenerated: header.generated,
    headerTld,
    headerDomains: header.domains,
    headerOk: headerMetaOk && actualSha256 === spec.sha256.toLowerCase(),
    acceptedRecords,
    rejectedRecords,
    duplicateRecords,
    headerLines,
  };

  const problems: string[] = [];
  if (!verification.sha256Match) {
    problems.push(
      `SHA-256 mismatch for ${spec.filename}: expected ${spec.sha256}, got ${actualSha256}`,
    );
  }
  if (header.generated !== snapshotDate) {
    problems.push(
      `Header Generated mismatch for ${spec.filename}: expected ${snapshotDate}, got ${header.generated}`,
    );
  }
  if (headerTld !== spec.tld.toLowerCase()) {
    problems.push(
      `Header TLD mismatch for ${spec.filename}: expected .${spec.tld}, got ${header.tld}`,
    );
  }
  if (header.domains !== spec.declaredDomains) {
    problems.push(
      `Header Domains mismatch for ${spec.filename}: expected ${spec.declaredDomains}, got ${header.domains}`,
    );
  }
  if (bodyLines !== spec.declaredDomains) {
    problems.push(
      `Body record count mismatch for ${spec.filename}: expected ${spec.declaredDomains} domain lines, got ${bodyLines}`,
    );
  }
  if (problems.length) {
    throw new SuffixDemandCounterError(
      `Input validation failed for ${spec.filename}`,
      problems,
    );
  }

  return { verification, acceptedDomainCount: acceptedRecords };
}

class HashThrough extends Transform {
  private readonly hash = createHash("sha256");

  override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null, data?: Buffer) => void,
  ): void {
    this.hash.update(chunk);
    callback(null, chunk);
  }

  digestHex(): string {
    return this.hash.digest("hex");
  }
}

function applyHeaderLine(header: HeaderState, line: string): void {
  const generated = matchHeader(line, "Generated");
  if (generated) {
    header.generated = generated;
    return;
  }
  const tld = matchHeader(line, "TLD");
  if (tld) {
    header.tld = tld;
    return;
  }
  const domains = matchHeader(line, "Domains");
  if (domains) {
    const n = Number(domains);
    header.domains = Number.isInteger(n) ? n : null;
    return;
  }
  const source = matchHeader(line, "Source");
  if (source) {
    header.source = source;
    return;
  }
  const method = matchHeader(line, "Method");
  if (method) {
    header.method = method;
  }
}

function matchHeader(line: string, key: string): string | null {
  const prefix = `# ${key}:`;
  if (!line.startsWith(prefix)) return null;
  return line.slice(prefix.length).trim() || null;
}
