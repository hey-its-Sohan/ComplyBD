import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import PipelineDiagram from "../components/PipelineDiagram.jsx";

/**
 * The product, explained in plain language.
 *
 * Written for a shop owner or a judge who has never seen the system, so it
 * avoids the vocabulary used everywhere else: no "grounding score", no
 * "confidence band", no "Merkle root". Each step says what happens and why it
 * matters, in that order.
 */

const STEPS = [
  {
    title: "We collect regulatory circulars",
    body: "NBR and VAT circulars are published in Bangla as PDFs and notices. ComplyBD gathers them in one place so nothing has to be found by hand.",
  },
  {
    title: "AI extracts the important information",
    body: "A model reads each circular and pulls out the parts a business cares about: who it applies to, what changed, when it starts and what happens if you ignore it.",
  },
  {
    title: "Every extracted field is checked against the original",
    body: "The system searches the circular for each value the AI produced. If the effective date is not written in the document, the system will not accept it — no matter how confident the AI sounded.",
  },
  {
    title: "Uncertain results go to human review",
    body: "Anything the check could not confirm is held back and sent to a person. It is never sent to a business while it is uncertain.",
  },
  {
    title: "Verified changes are matched with affected SMEs",
    body: "Once a person confirms it, the obligation is matched to businesses in that category. A restaurant rule reaches restaurants and nobody else.",
  },
  {
    title: "Businesses receive simple Bangla explanations",
    body: "Owners get a short card in Bangla: what changed, why it applies to them, what to do and by when — with a link to the original circular.",
  },
  {
    title: "Every published action is recorded",
    body: "Each step is written to a history that can only be added to. Each entry carries a fingerprint of the one before it, so editing or removing anything is detectable.",
  },
  {
    title: "Audit hashes can be anchored to a blockchain",
    body: "Periodically, one fingerprint covering the whole history is published. If someone later rewrote the records, they would no longer match what was published, and the tampering would be evident.",
  },
];

const FAQ = [
  {
    q: "Does the AI decide what the law says?",
    a: "No. The AI proposes; the system verifies against the document; a person approves. Anything unverified is held back rather than published.",
  },
  {
    q: "Is my business data sent to an AI company?",
    a: "No. Only the text of the public government circular is sent for extraction. Business names, owner names, TINs and VAT BINs never leave the server.",
  },
  {
    q: "What is the blockchain actually used for?",
    a: "One thing only: publishing a single fingerprint of the audit history so tampering is detectable. No business data goes on a chain, and the product runs fully without one.",
  },
  {
    q: "Can I rely on this for a tax filing?",
    a: "Treat it as an early warning and a pointer to the original circular. For anything high-stakes, confirm with a licensed accountant or lawyer.",
  },
];

export default function HowItWorks() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api
      .get("/demo/status")
      .then((res) => setStatus(res.data))
      .catch(() => setStatus(null));
  }, []);

  return (
    <>
      <Topbar title="How it works" subtitle="The whole system, in plain language" />

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <PipelineDiagram />

        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-display text-xl text-ink">Step by step</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-800 text-sm font-semibold tabular-nums text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{step.title}</p>
                  <p className="mt-1 text-sm leading-7 text-ink/65">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-display text-xl text-ink">Common questions</h2>
          <dl className="mt-4 space-y-4">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="text-sm font-semibold text-ink">{item.q}</dt>
                <dd className="mt-1 text-sm leading-7 text-ink/65">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {status ? (
          <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-card sm:p-6">
            <h2 className="font-display text-xl text-ink">What this installation is running</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-ink/45">Extraction engine</dt>
                <dd className="mt-0.5 text-ink/80">{status.extraction.active}</dd>
                <dd className="mt-0.5 text-xs leading-5 text-ink/50">{status.extraction.note}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/45">Blockchain anchoring</dt>
                <dd className="mt-0.5 text-ink/80">{status.blockchain.label}</dd>
                <dd className="mt-0.5 text-xs leading-5 text-ink/50">{status.blockchain.note}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/45">Verification</dt>
                <dd className="mt-0.5 text-xs leading-5 text-ink/50">
                  Grounding, confidence scoring, review routing and the audit hash chain behave
                  identically whether or not an external service is configured.
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        <section className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-5">
          <h2 className="font-display text-lg text-amber-900">Please read</h2>
          <p className="mt-2 text-sm leading-7 text-amber-900/85">
            Informational compliance tool only. This system does not provide legal or tax advice.
            Please consult a licensed accountant or lawyer for high-stakes decisions.
          </p>
          <p className="bn mt-2 text-sm leading-8 text-amber-900/75">
            এটি একটি তথ্যভিত্তিক সহায়ক টুল — আইনি বা কর বিষয়ক পরামর্শ নয়। গুরুত্বপূর্ণ সিদ্ধান্তের
            আগে লাইসেন্সপ্রাপ্ত হিসাবরক্ষক বা আইনজীবীর পরামর্শ নিন।
          </p>
        </section>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link to="/intelligence" className="text-forest-700 underline underline-offset-2">
            See the pipeline run
          </Link>
          <Link to="/audit" className="text-forest-700 underline underline-offset-2">
            Audit trail
          </Link>
          <Link to="/blockchain" className="text-forest-700 underline underline-offset-2">
            Blockchain anchors
          </Link>
        </div>
      </div>
    </>
  );
}
