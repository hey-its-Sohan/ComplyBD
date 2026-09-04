/**
 * A horizontal bar chart in plain SVG.
 *
 * The client has no charting dependency, and a category breakdown of at most
 * six rows does not justify adding one. Horizontal bars also let the Bangla and
 * English category names sit on one line without rotating labels.
 */
export default function BarChart({ data = [], title, emptyLabel = "No data yet", unit = "" }) {
  const rows = data.filter((d) => d && d.label);
  const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
      {title ? <h3 className="font-display text-lg text-ink">{title}</h3> : null}

      {rows.length ? (
        <ul className="mt-4 space-y-2.5">
          {rows.map((row) => {
            const value = Number(row.value) || 0;
            const pct = Math.round((value / max) * 100);
            return (
              <li key={row.label}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-ink/70">{row.label}</span>
                  <span className="shrink-0 tabular-nums font-semibold text-ink">
                    {value}
                    {unit}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-100"
                  role="img"
                  aria-label={`${row.label}: ${value}${unit}`}
                >
                  <div
                    className={`h-full rounded-full ${row.accent || "bg-forest-600"}`}
                    style={{ width: `${Math.max(pct, value > 0 ? 6 : 0)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink/45">{emptyLabel}</p>
      )}
    </div>
  );
}
