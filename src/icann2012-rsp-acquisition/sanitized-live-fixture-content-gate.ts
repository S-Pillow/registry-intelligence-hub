const CSRF_QUERY_VALUE = /([?&]_csrf=)([^&"'#\s]+)/gi;
const HIDDEN_INPUT_VALUE = /\bvalue=["']([^"']*)["']/i;

function scanHiddenInputByName(html: string, name: string): {
  count: number;
  nonExactRedactedCount: number;
} {
  const tagPattern = new RegExp(`<input[^>]*\\bname=["']${name.replace(/:/g, "\\:")}["'][^>]*>`, "gi");
  let count = 0;
  let nonExactRedactedCount = 0;
  for (const match of html.matchAll(tagPattern)) {
    count += 1;
    const valueMatch = HIDDEN_INPUT_VALUE.exec(match[0] ?? "");
    const value = valueMatch?.[1] ?? "";
    if (value !== "REDACTED") {
      nonExactRedactedCount += 1;
    }
  }
  return { count, nonExactRedactedCount };
}

const FORBIDDEN_MARKERS = [
  /\bset-cookie\s*:/i,
  /\bcookie\s*:/i,
  /\bauthorization\s*:/i,
  /\bbearer\s+[a-z0-9._-]+/i,
] as const;

export type SanitizedLiveFixtureContentScan = {
  csrfQueryCount: number;
  nonExactRedactedCsrfQueryCount: number;
  csrfInputCount: number;
  nonExactRedactedCsrfInputCount: number;
  formdataInputCount: number;
  nonExactRedactedFormdataCount: number;
};

export function scanSanitizedLiveFixtureHtmlContent(html: string): SanitizedLiveFixtureContentScan {
  let csrfQueryCount = 0;
  let nonExactRedactedCsrfQueryCount = 0;
  for (const match of html.matchAll(CSRF_QUERY_VALUE)) {
    csrfQueryCount += 1;
    const value = match[2] ?? "";
    if (value !== "REDACTED") {
      nonExactRedactedCsrfQueryCount += 1;
    }
  }

  const csrfInputScan = scanHiddenInputByName(html, "_csrf");
  const formdataInputScan = scanHiddenInputByName(html, "t:formdata");

  return {
    csrfQueryCount,
    nonExactRedactedCsrfQueryCount,
    csrfInputCount: csrfInputScan.count,
    nonExactRedactedCsrfInputCount: csrfInputScan.nonExactRedactedCount,
    formdataInputCount: formdataInputScan.count,
    nonExactRedactedFormdataCount: formdataInputScan.nonExactRedactedCount,
  };
}

export function assertSanitizedLiveFixtureHtmlContent(html: string): SanitizedLiveFixtureContentScan {
  for (const pattern of FORBIDDEN_MARKERS) {
    if (pattern.test(html)) {
      throw new Error("sanitized-live fixture HTML contains forbidden auth/cookie material");
    }
  }

  const scan = scanSanitizedLiveFixtureHtmlContent(html);
  if (scan.nonExactRedactedCsrfQueryCount > 0) {
    throw new Error("sanitized-live fixture HTML has _csrf query values that are not exactly REDACTED");
  }
  if (scan.nonExactRedactedCsrfInputCount > 0) {
    throw new Error("sanitized-live fixture HTML has hidden _csrf input values that are not exactly REDACTED");
  }
  if (scan.nonExactRedactedFormdataCount > 0) {
    throw new Error("sanitized-live fixture HTML has t:formdata values that are not exactly REDACTED");
  }
  return scan;
}
