/**
 * The whole system in one row: AI → Grounding → Human review → Alert → Audit →
 * Anchor.
 *
 * This exists so a judge can understand the architecture in a few seconds
 * without reading anything else. It is built from ordinary React elements
 * rather than an image, so the live counts and the current chain status are
 * real values, not a drawing that could drift out of date.
 */

const STAGES = [
  {
    key: "ai",
    icon: "🤖",
    title: "AI extraction",
    body: "A model proposes the category, obligation, effective date and penalty from the Bangla circular.",
    tone: "bg-indigo-50 text-indigo-900 ring-indigo-200",
  },
  {
    key: "grounding",
    icon: "🔍",
    title: "Grounding check",
    body: "Every proposed field is searched for in the original text. No model is involved in this step.",
    tone: "bg-amber-50 text-amber-900 ring-amber-200",
  },
  {
    key: "review",
    icon: "👤",
    title: "Human review",
    body: "Anything ungrounded or low-confidence is held for a named reviewer to approve or reject.",
    tone: "bg-sky-50 text-sky-900 ring-sky-200",
  },
  {
    key: "alert",
    icon: "🔔",
    title: "Alert to SME",
    body: "Only verified obligations are matched to businesses and sent as plain-Bangla guidance.",
    tone: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  },
  {
    key: "audit",
    icon: "🔒",
    title: "Audit trail",
    body: "Each step is appended to a hash-chained log. Editing any record breaks every hash after it.",
    tone: "bg-slate-100 text-slate-800 ring-slate-300",
  },
  {
    key: "anchor",
    icon: "⛓",
    title: "Hash anchor",
    body: "One digest committing to the whole trail is published periodically, giving tamper evidence.",
    tone: "bg-violet-50 text-violet-900 ring-violet-200",
  },
];

export default function PipelineDiagram({ counts = {}, compact = false }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
      <h3 className="font-display text-lg text-ink">How ComplyBD works</h3>
      <p className="mt-0.5 text-xs text-ink/50">
        A regulation becomes trusted guidance only by passing every stage below.
      </p>

      <ol className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {STAGES.map((stage, i) => (
          <li key={stage.key} className="flex flex-1 items-stretch gap-2">
            <div className={`flex-1 rounded-xl px-3 py-3 ring-1 ${stage.tone}`}>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <span aria-hidden="true">{stage.icon}</span>
                {stage.title}
              </p>
              {!compact ? (
                <p className="mt-1 text-[11px] leading-5 opacity-80">{stage.body}</p>
              ) : null}
              {counts[stage.key] !== undefined ? (
                <p className="mt-1.5 text-xs font-semibold tabular-nums opacity-90">
                  {counts[stage.key]}
                </p>
              ) : null}
            </div>

            {i < STAGES.length - 1 ? (
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
    </div>
  );
}
