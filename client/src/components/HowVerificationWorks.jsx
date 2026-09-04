import { useState } from "react";
import Modal from "./Modal.jsx";

/**
 * The four-step explanation of why anything on these screens can be trusted.
 * Steps are numbered because this genuinely is a sequence — each one only
 * happens if the previous one did.
 */

const STEPS = [
  {
    title: "AI extracts the obligation",
    body: "A model reads the Bangla circular and proposes the affected category, the obligation, the effective date and the penalty.",
  },
  {
    title: "The system checks it against the source",
    body: "Every proposed field is searched for in the original document. Matches are stored with the exact words and their character positions.",
  },
  {
    title: "Low-confidence results go to human review",
    body: "If the effective date or penalty cannot be found in the text, the obligation is capped at low confidence and held back.",
  },
  {
    title: "Only verified obligations reach businesses",
    body: "Alerts are matched to SME profiles from verified obligations alone. Rejected and pending items never leave the queue.",
  },
];

export function HowVerificationWorksBody({ compact = false }) {
  return (
    <ol className={compact ? "space-y-3" : "space-y-4"}>
      {STEPS.map((step, i) => (
        <li key={step.title} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-800 text-xs font-semibold tabular-nums text-white">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{step.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-ink/55">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function HowVerificationWorks({ variant = "card" }) {
  const [open, setOpen] = useState(false);

  if (variant === "link") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="text-sm text-forest-700 underline underline-offset-2 hover:text-forest-800"
        >
          How verification works
        </button>
        <Modal open={open} title="How verification works" onClose={() => setOpen(false)}>
          <HowVerificationWorksBody />
          <p className="mt-5 border-t border-black/5 pt-4 text-xs leading-5 text-ink/50">
            Informational compliance tool only. This system does not provide legal or tax advice.
            Please consult a licensed accountant or lawyer for high-stakes decisions.
          </p>
        </Modal>
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
      <h3 className="font-display text-lg text-ink">How verification works</h3>
      <p className="mt-0.5 mb-4 text-xs text-ink/50">
        Why an alert on this screen can be trusted.
      </p>
      <HowVerificationWorksBody compact />
    </div>
  );
}
