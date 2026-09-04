/**
 * The pipeline expressed as live numbers.
 *
 * This is the first thing on the dashboard because it is the whole product in
 * one glance: circulars come in, obligations come out, most are verified
 * automatically, some are held back, and a specific number of real businesses
 * are affected. Every figure is read from the database rather than written in.
 *
 * The "need review" step is styled as a warning rather than a failure — items
 * being held back is the system working, not breaking.
 */
export default function ComplianceFunnel({ stats, loading = false }) {
  const steps = [
    {
      key: "circulars",
      value: stats?.newRegulatoryChanges,
      label: "New regulatory changes",
      hint: "NBR circulars ingested",
      tone: "bg-white text-ink ring-black/5",
    },
    {
      key: "extracted",
      value: stats?.obligationsExtracted,
      label: "Obligations extracted",
      hint: "Proposed by the extraction engine",
      tone: "bg-indigo-50 text-indigo-900 ring-indigo-200",
    },
    {
      key: "verified",
      value: stats?.verifiedObligations,
      label: "Verified",
      hint: "Grounded and released",
      tone: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    },
    {
      key: "review",
      value: stats?.requiresReview,
      label: "Need review",
      hint: "Held back from clients",
      tone: "bg-amber-50 text-amber-900 ring-amber-200",
    },
    {
      key: "clients",
      value: stats?.affectedClients,
      label: "Clients affected",
      hint: "Matched to your book",
      tone: "bg-forest-50 text-forest-900 ring-forest-200",
    },
  ];

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-lg text-ink">This month at a glance</h2>
        <p className="text-xs text-ink/40">Live figures from the current database</p>
      </div>

      <ol className="mt-5 flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {steps.map((step, i) => (
          <li key={step.key} className="flex flex-1 items-stretch gap-2">
            <div className={`flex-1 rounded-xl px-4 py-3.5 ring-1 ${step.tone}`}>
              {loading ? (
                <div className="h-8 w-12 animate-pulse rounded bg-black/10" />
              ) : (
                <p className="font-display text-3xl tabular-nums leading-none">
                  {step.value ?? 0}
                </p>
              )}
              <p className="mt-1.5 text-sm font-semibold leading-tight">{step.label}</p>
              <p className="mt-0.5 text-[11px] leading-4 opacity-70">{step.hint}</p>
            </div>

            {i < steps.length - 1 ? (
              <div
                className="flex shrink-0 items-center justify-center text-ink/25"
                aria-hidden="true"
              >
                <span className="lg:hidden">↓</span>
                <span className="hidden lg:inline">→</span>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
