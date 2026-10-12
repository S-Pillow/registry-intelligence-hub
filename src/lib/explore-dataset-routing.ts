/**
 * HIST-EXPLORE-ROUTING-1 — explicit historical dataset outranks promoted ActiveV2 Explore.
 *
 * When the URL selects `dataset=2012-historical`, Explore must render the historical
 * surface even if the hub registry resolution mode is `promoted-2026-v2`.
 * Default / plain Explore (no historical dataset) keeps the promoted ActiveV2 path.
 */

export type ExploreSurfaceView = "explore" | string;

export function shouldRenderHistoricalExploreSurface(args: {
  view?: ExploreSurfaceView | null;
  exploreDataset?: string | null;
}): boolean {
  return args.view === "explore" && args.exploreDataset === "2012-historical";
}
