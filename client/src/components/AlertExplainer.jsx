import { Link } from "react-router-dom";
import VerificationBadges from "./VerificationBadges.jsx";

/**
 * One alert, answered as the four questions a business owner actually asks.
 *
 * The same component serves the accountant's Alert Center and the owner's
 * detail view, so the two roles can never be shown different explanations of
 * the same change. The owner variant simply hides the technical footer.
 *
 * Wording stays descriptive throughout — what the circular says and what a
 * business in this category would normally do — never "you are required to".
 */

const PRIORITY = {
  high: { dot: "🔴", label: "জরুরি", en: "Urgent", ring: "border-rose-200 bg-rose-50/60" },
  medium: { dot: "🟡", label: "গুরুত্বপূর্ণ", en: "Important", ring: "border-amber-200 bg-amber-50/50" },
  low: { dot: "🟢", label: "তথ্য", en: "For information", ring: "border-emerald-200 bg-emerald-50/50" },
};

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Question({ label, bangla, children }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-forest-700">
        {label}
        {bangla ? <span className="bn ml-1.5 font-normal text-ink/40">{bangla}</span> : null}
      </p>
      <div className="mt-1 text-sm leading-7 text-ink/85">{children}</div>
    </div>
  );
}

export default function AlertExplainer({ alert, variant = "full" }) {
  if (!alert) return null;

  const ob = alert.obligationId || {};
  const circular = ob.circularId || {};
  const business = alert.businessId || {};
  const tone = PRIORITY[alert.priority] || PRIORITY.medium;
  const effective = formatDate(alert.effectiveDate || ob.effectiveDate);
  const simple = variant === "simple";

  return (
    <article className={`rounded-2xl border p-5 shadow-card ${tone.ring}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span aria-hidden="true">{tone.dot}</span>
            <span className="bn">{tone.label}</span>
            <span className="text-ink/35">·</span>
            <span className="text-ink/50">{tone.en}</span>
          </p>
          {!simple ? <p className="bn mt-1.5 text-xs text-ink/50">{business.name}</p> : null}
        </div>
        <VerificationBadges obligation={ob} showConfidence={!simple} />
      </div>

      <div className="mt-4 space-y-3.5">
        <Question label="What changed?" bangla="কী পরিবর্তন হয়েছে?">
          <span className="bn">{alert.whatChanged || alert.messageBangla}</span>
        </Question>

        <Question label="Why does it matter?" bangla="কেন এটি গুরুত্বপূর্ণ?">
          <span className="bn">
            {alert.whyItMatters ||
              `আপনার ${business.category || "ব্যবসার"} ধরনের প্রতিষ্ঠানের জন্য এটি প্রযোজ্য।`}
          </span>
        </Question>

        <Question label="What should the business do?" bangla="করণীয় কী?">
          <span className="bn">
            {alert.whatToDo || ob.requiredAction || "পরিপত্রটি হিসাবরক্ষকের সঙ্গে দেখে নিন।"}
          </span>
        </Question>

        <Question label="When does it take effect?" bangla="কবে থেকে কার্যকর?">
          {effective ? (
            <span>{effective}</span>
          ) : (
            <span className="text-amber-800">
              The circular does not state a date.{" "}
              <span className="bn">কার্যকর তারিখ পরিপত্রে উল্লেখ নেই।</span>
            </span>
          )}
        </Question>

        <Question label="Source" bangla="সূত্র">
          <span className="bn block leading-6">{circular.title || "—"}</span>
          <span className="mt-0.5 block text-xs text-ink/45">
            {circular.source || "NBR"}
            {circular.sourceUrl ? (
              <>
                {" · "}
                <a
                  href={circular.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-forest-700"
                >
                  Open the original
                </a>
              </>
            ) : null}
          </span>
        </Question>
      </div>

      {!simple ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3">
          <p className="text-xs text-ink/45">
            {ob.obligationType} · {ob.businessCategory}
            {ob.groundingStatus ? ` · ${ob.groundingStatus}` : ""}
          </p>
          <Link
            to={`/alerts/${alert._id}`}
            className="text-sm text-forest-700 underline underline-offset-2 hover:text-forest-800"
          >
            Open evidence
          </Link>
        </div>
      ) : null}
    </article>
  );
}
