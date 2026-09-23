const CSRF_QUERY_VALUE = /([?&]_csrf=)([^&"'#\s]+)/gi;
const CSRF_INPUT = /<input[^>]*\bname=["']_csrf["'][^>]*\bvalue=["']([^"']*)["']/gi;
const FORMDATA_INPUT = /<input[^>]*\bname=["']t:formdata["'][^>]*\bvalue=["']([^"']*)["']/gi;

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

  let csrfInputCount = 0;
  let nonExactRedactedCsrfInputCount = 0;
  for (const match of html.matchAll(CSRF_INPUT)) {
    csrfInputCount += 1;
    const value = match[1] ?? "";
    if (value !== "REDACTED") {
      nonExactRedactedCsrfInputCount += 1;
    }
  }

  let formdataInputCount = 0;
  let nonExactRedactedFormdataCount = 0;
  for (const match of html.matchAll(FORMDATA_INPUT)) {
    formdataInputCount += 1;
    const value = match[1] ?? "";
    if (value !== "REDACTED") {
      nonExactRedactedFormdataCount += 1;
    }
  }

  return {
    csrfQueryCount,
    nonExactRedactedCsrfQueryCount,
    csrfInputCount,
    nonExactRedactedCsrfInputCount,
    formdataInputCount,
    nonExactRedactedFormdataCount,
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
