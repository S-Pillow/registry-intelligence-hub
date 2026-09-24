import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import {
  RSP_ACQUISITION_AUTH_ENV,
  RSP_MAPPING_LIVE_AUTH_ENV,
  RSP_PILOT_LIVE_AUTH_ENV,
  RSP_PORTION_DIAGNOSTIC_AUTH_ENV,
} from "./constants";

/** Substrings that must never appear in persisted evidence, manifests, or operator logs. */
export const FORBIDDEN_SENSITIVE_ARTIFACT_SUBSTRINGS = [
  "set-cookie",
  "jsessionid",
  "cookie:",
  "x-csrf-token",
  "authorization:",
  RSP_MAPPING_LIVE_AUTH_ENV.toLowerCase(),
  RSP_PILOT_LIVE_AUTH_ENV.toLowerCase(),
  RSP_PORTION_DIAGNOSTIC_AUTH_ENV.toLowerCase(),
  RSP_ACQUISITION_AUTH_ENV.toLowerCase(),
] as const;

/** JSON keys / header names — `csrf` alone avoids flagging Tapestry `_csrf` in unrelated HTML prose. */
export const FORBIDDEN_SENSITIVE_JSON_KEYS = [
  "cookie",
  "cookies",
  "set-cookie",
  "csrf",
  "csrftoken",
  "authorization",
  "x-csrf-token",
] as const;

export const SENSITIVE_ARTIFACT_FAILURE_POLICY =
  "Fail closed before writing evidence-bundle manifest, mapping-review report, or provenance summary if cookies, CSRF/session header names, or RSP auth env identifiers/values would be persisted. Operator must scrub staging and re-run offline post-steps only." as const;

export class SensitiveArtifactError extends Error {
  readonly findings: string[];

  constructor(findings: string[]) {
    super(
      `Refusing to persist operator evidence: sensitive session/auth material detected (${findings.length} finding(s)). ` +
        "Remove cookies, CSRF/session headers, and auth env values from staging before manifest or provenance output.",
    );
    this.name = "SensitiveArtifactError";
    this.findings = findings;
  }
}

function lowerIncludesAny(haystack: string, needles: readonly string[]): string | null {
  const lower = haystack.toLowerCase();
  for (const needle of needles) {
    if (lower.includes(needle)) return needle;
  }
  return null;
}

const LIVE_SESSION_QUERY_PATTERN =
  /(?:[?&]|&amp;)(?:_csrf|csrf|csrfToken|jsessionid)=([^&"'#\s]+)/gi;

const REDACTED_SESSION_VALUE = /^REDACTED$/i;

/** Scan SAFE_DERIVED persisted strings for live session query values. */
export function scanSafeDerivedStringsForLiveSessionMaterial(
  text: string,
  contextLabel: string,
): string[] {
  const findings: string[] = [];
  LIVE_SESSION_QUERY_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LIVE_SESSION_QUERY_PATTERN.exec(text)) !== null) {
    const value = match[1] ?? "";
    if (value.length > 0 && !REDACTED_SESSION_VALUE.test(value)) {
      findings.push(`${contextLabel}: live session query value in SAFE_DERIVED text`);
      break;
    }
  }
  return findings;
}

export function scanTextForSensitiveArtifactMaterial(
  text: string,
  contextLabel: string,
): string[] {
  const findings: string[] = [];
  const hit = lowerIncludesAny(text, FORBIDDEN_SENSITIVE_ARTIFACT_SUBSTRINGS);
  if (hit) {
    findings.push(`${contextLabel}: forbidden substring "${hit}"`);
  }
  if (contextLabel.endsWith(".json")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      findings.push(...scanJsonValueForForbiddenKeys(parsed, contextLabel));
      findings.push(...scanJsonSafeDerivedStringValues(parsed, contextLabel));
    } catch {
      /* non-JSON text file — substring scan only */
    }
  }

  return findings;
}

/**
 * Boolean pager-transaction observations. The key names describe that a
 * session cookie was sent or that an intermediate Set-Cookie was seen.
 * Values must stay boolean so cookie material cannot hide in the field.
 */
const ALLOWED_BOOLEAN_DIAGNOSTIC_KEYS = new Set([
  "sessioncookiesent",
  "intermediatesetcookieobserved",
  "sessionupdatedduringtransaction",
]);

/**
 * Count of Set-Cookie header lines. The key names the header, but the value
 * must be a small integer so a cookie or token cannot hide in the field.
 */
const ALLOWED_NUMERIC_DIAGNOSTIC_KEYS = new Set(["setcookieheadercount"]);

function isSafeDiagnosticCount(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 256;
}

const SAFE_DERIVED_JSON_KEY_MARKERS = ["safe", "safederived"] as const;

function isSafeDerivedJsonKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SAFE_DERIVED_JSON_KEY_MARKERS.some((marker) => lower.includes(marker));
}

function scanJsonSafeDerivedStringValues(
  value: unknown,
  contextLabel: string,
  path = "",
): string[] {
  const findings: string[] = [];
  if (value == null) return findings;
  if (typeof value === "string") {
    const leafKey = path.split(".").pop() ?? path;
    if (isSafeDerivedJsonKey(leafKey)) {
      findings.push(
        ...scanSafeDerivedStringsForLiveSessionMaterial(
          value,
          `${contextLabel}:${path || leafKey}`,
        ),
      );
    }
    return findings;
  }
  if (typeof value !== "object") return findings;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      findings.push(...scanJsonSafeDerivedStringValues(value[i], contextLabel, `${path}[${i}]`));
    }
    return findings;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    findings.push(...scanJsonSafeDerivedStringValues(child, contextLabel, childPath));
  }
  return findings;
}

function scanJsonValueForForbiddenKeys(value: unknown, contextLabel: string, path = ""): string[] {
  const findings: string[] = [];
  if (value == null || typeof value !== "object") return findings;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      findings.push(...scanJsonValueForForbiddenKeys(value[i], contextLabel, `${path}[${i}]`));
    }
    return findings;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const keyLower = key.toLowerCase();
    if (ALLOWED_BOOLEAN_DIAGNOSTIC_KEYS.has(keyLower)) {
      if (typeof child !== "boolean") {
        findings.push(
          `${contextLabel}: diagnostic key "${path ? `${path}.` : ""}${key}" must be boolean`,
        );
      }
      continue;
    }
    if (ALLOWED_NUMERIC_DIAGNOSTIC_KEYS.has(keyLower)) {
      if (!isSafeDiagnosticCount(child)) {
        findings.push(
          `${contextLabel}: diagnostic key "${path ? `${path}.` : ""}${key}" must be a non-negative integer count`,
        );
      }
      continue;
    }
    if (FORBIDDEN_SENSITIVE_JSON_KEYS.some((f) => keyLower.includes(f))) {
      findings.push(`${contextLabel}: forbidden JSON key "${path ? `${path}.` : ""}${key}"`);
    }
    findings.push(...scanJsonValueForForbiddenKeys(child, contextLabel, path ? `${path}.${key}` : key));
  }
  return findings;
}

export function assertNoSensitiveArtifactMaterial(text: string, contextLabel: string): void {
  const findings = scanTextForSensitiveArtifactMaterial(text, contextLabel);
  if (findings.length > 0) {
    throw new SensitiveArtifactError(findings);
  }
}

const TEXT_EVIDENCE_SUFFIXES = [".json", ".txt", ".log"] as const;

export async function assertStagingTextEvidenceSafeForBundle(input: {
  stagingRoot: string;
  absolutePaths: string[];
}): Promise<void> {
  const findings: string[] = [];
  for (const absolute of input.absolutePaths) {
    const rel = relative(input.stagingRoot, absolute).replace(/\\/g, "/");
    const lower = rel.toLowerCase();
    if (!TEXT_EVIDENCE_SUFFIXES.some((s) => lower.endsWith(s))) continue;
    const text = await readFile(absolute, "utf8");
    findings.push(...scanTextForSensitiveArtifactMaterial(text, rel));
  }
  if (findings.length > 0) {
    throw new SensitiveArtifactError(findings);
  }
}
