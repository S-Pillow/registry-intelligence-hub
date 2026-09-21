import { GTLDRESULT_ORIGIN, GTLDRESULT_PATHS } from "./constants";

export function absoluteGtldresultUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${GTLDRESULT_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildPortionUrl(gtldresultAcId: number): string {
  return absoluteGtldresultUrl(GTLDRESULT_PATHS.downloadPublicPortion(gtldresultAcId));
}

export function buildDetailsUrl(gtldresultAcId: number): string {
  return absoluteGtldresultUrl(GTLDRESULT_PATHS.applicationDetails(gtldresultAcId));
}

export function buildPortionUrlPlaceholder(): string {
  return absoluteGtldresultUrl(
    GTLDRESULT_PATHS.downloadPublicPortion("{gtldresultAcId}"),
  );
}
