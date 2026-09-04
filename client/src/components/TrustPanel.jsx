import { Link } from "react-router-dom";

/**
 * The five-sentence explanation of why anything here can be trusted, plus the
 * live state of the audit chain.
 *
 * The status line is deliberately not decorative: it reads from the real
 * verification result, so if the chain were ever broken this panel would say so
 * on whatever screen it happens to be sitting on.
 */

const STEPS = [
  "AI generates a candidate extraction.",
  "The system independently checks it against the source document.",
  "Low-confidence or ungrounded results require human review.",
  "Published guidance is recorded in an append-only audit trail.",
  "Periodic hash anchoring provides tamper evidence.",
];

function ChainStatus({ summary }) {
  if (!summary) {
    return <p className="text-xs text-ink/40">Checking the audit chain…</p>;
  }

  const intact = summary.verification?.intact;
  const anchored = summary.anchorCount > 0;

  return (
    <div className="space-y-2">
      <p
        className={`flex items-center gap-2 text-sm font-semibold ${
          intact ? "text-emerald-800" : "text-rose-800"
        }`}
      >
        <span aria-hidden="true">{intact ? "✓" : "⚠"}</span>
        {intact ? "Audit chain intact" : "Audit chain integrity compromised"}
      </p>

      <dl className="space-y-1 text-xs text-ink/60">
        <div className="flex justify-between gap-3">
          <dt>Audit records</dt>
          <dd className="tabular-nums font-semibold text-ink">{summary.totalRecords}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Latest hash</dt>
          <dd className="font-mono text-[11px] text-ink/70">
            {String(summary.latestHash || "").slice(0, 12)}…
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Anchors published</dt>
          <dd className="tabular-nums font-semibold text-ink">{summary.anchorCount}</dd>
        </div>
        {summary.unanchoredRecords > 0 ? (
          <div className="flex justify-between gap-3">
            <dt>Not yet anchored</dt>
            <dd className="tabular-nums font-semibold text-amber-700">
              {summary.unanchoredRecords}
            </dd>
          </div>
        ) : null}
      </dl>

      {summary.blockchain ? (
        <p className="rounded-lg bg-clay/60 px-3 py-2 text-[11px] leading-5 text-ink/55">
          {summary.blockchain.label}
          {anchored ? "" : " — none published yet"}. {summary.blockchain.disclosure}
        </p>
      ) : null}
    </div>
  );
}

export default function TrustPanel({ summary, showLinks = true }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
      <h3 className="font-display text-lg text-ink">Trust &amp; verification</h3>
      <p className="mt-0.5 text-xs text-ink/50">
        What has to happen before guidance reaches a business.
      </p>

      <ol className="mt-4 space-y-2.5">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest-800 text-[11px] font-semibold tabular-nums text-white">
              {i + 1}
            </span>
            <span className="text-xs leading-5 text-ink/70">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 border-t border-black/5 pt-4">
        <ChainStatus summary={summary} />
      </div>

      {showLinks ? (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-black/5 pt-3 text-xs">
          <Link to="/audit" className="text-forest-700 underline underline-offset-2">
            Audit trail
          </Link>
          <Link to="/blockchain" className="text-forest-700 underline underline-offset-2">
            Blockchain anchors
          </Link>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-5 text-ink/40">
        Informational compliance tool only — not legal or tax advice.
      </p>
    </div>
  );
}
