/**
 * The provenance of an obligation, at a glance.
 *
 * These three facts are separate on purpose. "AI extracted" and "Human reviewed"
 * are not alternatives — an obligation can be both, and a reader deserves to
 * know which. Collapsing them into one "Verified" tick would hide exactly the
 * thing the product is built to expose.
 */

function Chip({ tone = "neutral", title, children }) {
  const tones = {
    verified: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    ai: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    human: "bg-sky-50 text-sky-800 ring-sky-200",
    pending: "bg-amber-50 text-amber-800 ring-amber-200",
    rejected: "bg-rose-50 text-rose-800 ring-rose-200",
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tones[tone] || tones.neutral}`}
    >
      {children}
    </span>
  );
}

export function ConfidenceChip({ value, band }) {
  if (value === undefined || value === null) return null;
  const n = Math.round(Number(value) || 0);
  const tone =
    band === "high" || n >= 80
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : band === "medium" || n >= 55
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-rose-50 text-rose-800 ring-rose-200";
  return (
    <span
      title="How strongly the extracted fields were supported by the source circular"
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ring-1 ${tone}`}
    >
      {n}% confidence
    </span>
  );
}

export default function VerificationBadges({ obligation, showConfidence = true }) {
  if (!obligation) return null;

  const isVerified = obligation.reviewStatus === "verified";
  const isRejected = obligation.reviewStatus === "rejected";
  const humanReviewed = Boolean(obligation.verifiedBy) && !obligation.autoVerified;
  const aiExtracted = Boolean(obligation.extractionMethod) || Boolean(obligation.pipelineVersion);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isVerified ? (
        <Chip tone="verified" title="Checked against the source circular and released to businesses">
          ✓ Verified
        </Chip>
      ) : isRejected ? (
        <Chip tone="rejected" title="A reviewer rejected this. No alerts were sent.">
          Rejected
        </Chip>
      ) : (
        <Chip tone="pending" title="Awaiting a human decision. Not sent to any business yet.">
          Awaiting review
        </Chip>
      )}

      {aiExtracted ? (
        <Chip tone="ai" title={`Fields proposed by ${obligation.extractionMethod || "the extraction engine"}`}>
          AI extracted
        </Chip>
      ) : null}

      {humanReviewed ? (
        <Chip tone="human" title="A named reviewer approved this obligation">
          Human reviewed
        </Chip>
      ) : obligation.autoVerified ? (
        <Chip tone="neutral" title="Auto-verified: every checked field was found in the source text">
          Auto-verified
        </Chip>
      ) : null}

      {showConfidence ? (
        <ConfidenceChip value={obligation.confidence} band={obligation.confidenceBand} />
      ) : null}
    </div>
  );
}
