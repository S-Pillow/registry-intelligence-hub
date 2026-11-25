export default function ForecastLocalPreviewNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8" data-testid="forecast-local-preview-not-found">
      <h1 className="text-xl font-bold text-slate-950">Local forecast preview unavailable</h1>
      <p className="mt-2 text-sm text-slate-700">
        This development-only route is disabled unless{" "}
        <code className="rounded bg-slate-100 px-1">NODE_ENV=development</code> and{" "}
        <code className="rounded bg-slate-100 px-1">RIH_FORECAST_LOCAL_PREVIEW=1</code>.
      </p>
    </main>
  );
}
