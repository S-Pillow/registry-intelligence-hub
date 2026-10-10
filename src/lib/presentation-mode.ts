/**
 * User-visible presentation mode. Default is pre-Reveal.
 * Demo / Rehearsal is an explicit query opt-in and does not touch claim actuality.
 */
export const PRESENTATION_QUERY_KEY = "presentation";
export const REHEARSAL_PRESENTATION_VALUE = "rehearsal";

export type ProductPresentation = "pre-reveal" | "rehearsal";

export function presentationFromSearchParam(value: string | string[] | undefined): ProductPresentation {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === REHEARSAL_PRESENTATION_VALUE ? "rehearsal" : "pre-reveal";
}

export function withRehearsalPresentation(href: string, presentation: ProductPresentation): string {
  if (presentation !== "rehearsal") return href;
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const params = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "");
  params.set(PRESENTATION_QUERY_KEY, REHEARSAL_PRESENTATION_VALUE);
  const query = params.toString();
  return `${path}?${query}${hash}`;
}

export function retainPresentationParam(params: URLSearchParams, presentation: ProductPresentation) {
  if (presentation === "rehearsal") params.set(PRESENTATION_QUERY_KEY, REHEARSAL_PRESENTATION_VALUE);
}

/** Synthetic 2026 rows stay hidden unless the user opted into rehearsal, or a promoted snapshot is active. */
export function withholdSyntheticPresentation(presentation: ProductPresentation, payloadMode: string | undefined): boolean {
  return presentation !== "rehearsal" && payloadMode !== "promoted-2026";
}

/** Browser-facing source for the 12-row rehearsal cohort. Not an ICANN publication. */
export const REHEARSAL_BROWSER_SOURCE = {
  name: "RIH synthetic rehearsal fixture",
  url: "synthetic-rehearsal:registry-applications",
  evidenceClass: "synthetic-rehearsal",
} as const;

export function isHttpSourceUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://");
}
