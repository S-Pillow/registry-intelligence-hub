export type ChangeSinceVisitInput = {
  lastOpenedAt: string;
  recordedCount: number;
  currentCount: number;
  fixtureChangedAt: string;
  now?: string;
};

export type ChangeSinceVisitSummary = {
  hasChanged: boolean;
  hasFixtureUpdate: boolean;
  hasCountDrift: boolean;
  headline: string;
  detail: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function formatUtcDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

/**
 * Compares recorded fixture-time snapshots to the current fixture, never to
 * a live/external feed. This is why a static rehearsal fixture will
 * legitimately report "no changes" indefinitely until the fixture itself is
 * republished with a newer `changedAt`.
 */
export function summarizeChangeSinceVisit(input: ChangeSinceVisitInput): ChangeSinceVisitSummary {
  const lastOpenedAt = new Date(input.lastOpenedAt).getTime();
  const fixtureChangedAt = new Date(input.fixtureChangedAt).getTime();
  const hasFixtureUpdate = fixtureChangedAt > lastOpenedAt;
  const hasCountDrift = input.recordedCount !== input.currentCount;
  const hasChanged = hasFixtureUpdate || hasCountDrift;

  if (!hasChanged) {
    return {
      hasChanged,
      hasFixtureUpdate,
      hasCountDrift,
      headline: "No changes since your last visit",
      detail: `Fixture snapshot unchanged since your last visit on ${formatUtcDate(input.lastOpenedAt)}. Result count steady at ${input.currentCount}.`,
    };
  }

  const parts: string[] = [];
  if (hasFixtureUpdate) parts.push(`Fixture snapshot updated ${formatUtcDate(input.fixtureChangedAt)}`);
  if (hasCountDrift) parts.push(`Result count moved from ${input.recordedCount} to ${input.currentCount}`);

  return {
    hasChanged,
    hasFixtureUpdate,
    hasCountDrift,
    headline: "Changes since your last visit",
    detail: `${parts.join(" · ")}. Compares recorded fixture state only — not live monitoring.`,
  };
}
