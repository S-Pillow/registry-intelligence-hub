export type ChangeSubject = "result" | "supporting-record";

export type ChangeSinceVisitInput = {
  lastOpenedAt: string;
  recordedCount: number;
  currentCount: number;
  fixtureChangedAt: string;
  /**
   * What `recordedCount`/`currentCount` measure, so the generated sentence
   * cannot be misread as a different count. Watchlists sum supporting
   * records across every watched entity — a very different number from the
   * watchlist's entity count — so they must pass `"supporting-record"`
   * rather than the default `"result"` used by Saved Research's result sets.
   */
  subject?: ChangeSubject;
  now?: string;
};

export type ChangeSinceVisitSummary = {
  hasChanged: boolean;
  hasFixtureUpdate: boolean;
  hasCountDrift: boolean;
  /**
   * The last point in fixture time a material change is known to have
   * happened. This fixture-honest model has exactly one source of change —
   * the fixture's own `changedAt` — so this is always that value; there is
   * no per-item or per-entity change timestamp to fall back to.
   */
  lastMaterialChangeAt: string;
  headline: string;
  detail: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function formatUtcDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

function describeCount(subject: ChangeSubject, recordedCount: number, currentCount: number): string {
  if (subject === "supporting-record") {
    return recordedCount === currentCount
      ? `Supporting records unchanged at ${currentCount}`
      : `Supporting records changed from ${recordedCount} to ${currentCount}`;
  }
  return recordedCount === currentCount
    ? `Result count steady at ${currentCount}`
    : `Result count moved from ${recordedCount} to ${currentCount}`;
}

/**
 * Compares recorded fixture-time snapshots to the current fixture, never to
 * a live/external feed. This is why a static rehearsal fixture will
 * legitimately report "no material change" indefinitely until the fixture
 * itself is republished with a newer `changedAt`. `lastMaterialChangeAt`
 * always reflects that single fixture-wide timestamp — the only change
 * event this fixture-honest model can attest to.
 */
export function summarizeChangeSinceVisit(input: ChangeSinceVisitInput): ChangeSinceVisitSummary {
  const subject = input.subject ?? "result";
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
      lastMaterialChangeAt: input.fixtureChangedAt,
      headline: "No material change since your last visit",
      detail: `Fixture snapshot unchanged since your last visit on ${formatUtcDate(input.lastOpenedAt)}. ${describeCount(subject, input.recordedCount, input.currentCount)}.`,
    };
  }

  const parts: string[] = [];
  if (hasFixtureUpdate) parts.push(`Fixture snapshot updated ${formatUtcDate(input.fixtureChangedAt)}`);
  if (hasCountDrift) parts.push(describeCount(subject, input.recordedCount, input.currentCount));

  return {
    hasChanged,
    hasFixtureUpdate,
    hasCountDrift,
    lastMaterialChangeAt: input.fixtureChangedAt,
    headline: "Material change since your last visit",
    detail: `${parts.join(" · ")}. Compares recorded fixture state only — not live monitoring.`,
  };
}
