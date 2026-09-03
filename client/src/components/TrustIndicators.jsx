/**
 * Small trust indicators.
 *
 * Each one stands for a check that either happened or did not. They are shown
 * in a muted "unmet" state rather than hidden when absent, because a missing
 * check is information too — an obligation with no human review should look
 * different from one that had it, not merely show one fewer badge.
 */

const TONES = {
  met: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  chain: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  unmet: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function TrustChip({ icon, label, tone = "met", title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
        TONES[tone] || TONES.met
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

/**
 * @param {object} props
 * @param {object} props.obligation
 * @param {boolean} [props.auditLogged]  whether the action was written to the trail
 * @param {boolean} [props.anchored]     whether an anchor covers it
 */
export default function TrustIndicators({ obligation = {}, auditLogged = true, anchored = false }) {
  const grounded = obligation.groundingStatus === "grounded";
  const verified = obligation.reviewStatus === "verified";
  const humanReviewed = Boolean(obligation.verifiedBy) && !obligation.autoVerified;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TrustChip
        icon="✓"
        label="Source verified"
        tone={verified ? "met" : "unmet"}
        title={
          verified
            ? "Checked against the circular and released to businesses"
            : "Not yet released — still awaiting a decision"
        }
      />
      <TrustChip
        icon="✓"
        label="Human reviewed"
        tone={humanReviewed ? "met" : "unmet"}
        title={
          humanReviewed
            ? "A named reviewer approved this"
            : obligation.autoVerified
              ? "Auto-verified: every checked field was found in the source"
              : "No human decision recorded yet"
        }
      />
      <TrustChip
        icon="✓"
        label="Grounded in source"
        tone={grounded ? "met" : "unmet"}
        title={
          grounded
            ? "Every checked field was located in the original document"
            : "At least one field could not be found in the source text"
        }
      />
      <TrustChip
        icon="🔒"
        label="Audit logged"
        tone={auditLogged ? "info" : "unmet"}
        title="Written to the append-only, hash-chained audit trail"
      />
      <TrustChip
        icon="⛓"
        label={anchored ? "Hash anchored" : "Not yet anchored"}
        tone={anchored ? "chain" : "unmet"}
        title={
          anchored
            ? "Covered by a published hash anchor, so later tampering is detectable"
            : "This record has not been covered by an anchor yet"
        }
      />
    </div>
  );
}
