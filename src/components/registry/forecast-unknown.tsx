export function formatForecastUnknownBoolean(value: boolean | null): "Yes" | "No" | "Unknown" {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

export function ForecastUnknownValue({ value }: { value: boolean | null }) {
  return <span>{formatForecastUnknownBoolean(value)}</span>;
}
