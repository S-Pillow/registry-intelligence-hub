"use client";

import Link from "next/link";
import { useForecastAvailability } from "@/components/registry/forecast-availability-provider";
import { forecastDetailHref, normalizeForecastLabel } from "@/lib/forecast-routes";

export type ForecastAvailability = {
  enabled: boolean;
  labels: ReadonlySet<string> | readonly string[];
};

function labelAvailable(availability: ForecastAvailability | null | undefined, label: string): boolean {
  if (!availability?.enabled) return false;
  const normalized = normalizeForecastLabel(label);
  if (!normalized) return false;
  const labels = availability.labels;
  if (labels instanceof Set) return labels.has(normalized);
  return (labels as readonly string[]).includes(normalized);
}

/**
 * Active forecast navigation only when the gated catalog includes the exact string.
 * Renders nothing (or optional fallback) when unavailable — never a dead link.
 */
export function ForecastLink({
  label,
  availability,
  children,
  className,
  testId,
  fallback = null,
}: {
  label: string;
  availability?: ForecastAvailability | null;
  children?: React.ReactNode;
  className?: string;
  testId?: string;
  fallback?: React.ReactNode;
}) {
  const ctx = useForecastAvailability();
  const resolved = availability ?? ctx;
  const href = forecastDetailHref(label);
  if (!href || !labelAvailable(resolved, label)) {
    return <>{fallback}</>;
  }
  const extension = `.${normalizeForecastLabel(label)}`;
  return (
    <Link
      href={href}
      className={className ?? "font-semibold text-[#006a56] underline-offset-2 hover:underline"}
      data-testid={testId ?? `forecast-link-${normalizeForecastLabel(label)}`}
    >
      {children ?? extension}
    </Link>
  );
}
