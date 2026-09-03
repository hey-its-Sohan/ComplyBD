import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import ConfidenceMeter from "../components/ConfidenceMeter.jsx";
import VerificationBadges from "../components/VerificationBadges.jsx";
import HowVerificationWorks from "../components/HowVerificationWorks.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { LoadingBlock, ErrorBlock } from "../components/StateViews.jsx";
import { useToast } from "../context/ToastContext.jsx";

/**
 * The reviewer's workbench.
 *
 * The layout is an argument: the AI's interpretation on the left, the document
 * it claims to come from on the right, and each field marked with whether the
 * system could actually find it. A reviewer should be able to decide without
 * reading the whole circular — but should always be able to.
 */

const FIELD_LABELS = {
  businessCategory: "Affected category",
  obligationType: "Obligation type",
  effectiveDate: "Effective date",
  penalty: "Penalty",
};

function formatDate(value) {
  if (!value) return "— not extracted —";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Renders the circular with grounded evidence highlighted at real offsets. */
function SourceDocument({ text, spans, activeField, onSelect }) {
  const segments = useMemo(() => {
    const valid = (spans || [])
      .filter((s) => typeof s.start === "number" && typeof s.end === "number" && s.end > s.start)
      .sort((a, b) => a.start - b.start);

    const out = [];
    let cursor = 0;
    valid.forEach((span) => {
      const start = Math.max(cursor, Math.min(span.start, text.length));
      const end = Math.max(start, Math.min(span.end, text.length));
      if (start >= end) return;
      if (start > cursor) out.push({ type: "text", text: text.slice(cursor, start) });
      out.push({ type: "mark", text: text.slice(start, end), field: span.field });
      cursor = end;
    });
    if (cursor < text.length) out.push({ type: "text", text: text.slice(cursor) });
    return out;
  }, [text, spans]);

  return (
    <pre className="bn max-h-[26rem] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-clay/40 p-4 font-sans text-sm leading-8 text-ink/85">
      {segments.map((seg, i) =>
        seg.type === "mark" ? (
          <mark
            key={i}
            onClick={() => onSelect && onSelect(seg.field)}
            className={`cursor-pointer rounded px-0.5 ${
              seg.field === activeField
                ? "bg-forest-300 ring-2 ring-forest-500"
                : "bg-amber-200/70 hover:bg-amber-300/70"
            }`}
            title={FIELD_LABELS[seg.field] || seg.field}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </pre>
  );
}

export default function ReviewQueue() {
  const { push } = useToast();
  const [params] = useSearchParams();
  const [queue, setQueue] = useState(null);
  const [summary, setSummary] = useState(null);
  const [active, setActive] = useState(null);
  const [activeField, setActiveField] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [needsOverride, setNeedsOverride] = useState(false);
  const [reason, setReason] = useState("");

  const load = async (keepId) => {
    setError(null);
    try {
      const res = await api.get("/reviews/queue");
      setQueue(res.data.queue);
      setSummary(res.data.summary);
      const focus = keepId || params.get("focus");
      const found = res.data.queue.find((r) => r._id === focus);
      setActive(found || res.data.queue[0] || null);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setNeedsOverride(false);
    setReason("");
    setActiveField(null);
  }, [active?._id]);

  const decide = async (action) => {
    if (!active) return;
    setBusy(true);
    try {
      const body =
        action === "approve" ? { override: needsOverride, overrideReason: reason } : { reason };
      const res = await api.post(`/reviews/${active._id}/${action}`, body);
      push(
        action === "approve"
          ? `Approved — ${res.data.alertsCreated} alert(s) published`
          : "Rejected — no alerts published"
      );
      await load();
    } catch (err) {
      const data = err?.response?.data;
      if (data?.requiresOverride) {
        setNeedsOverride(true);
        push(data.message, "error");
      } else {
        push(data?.message || "Could not record that decision", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <>
        <Topbar title="Review queue" />
        <div className="p-6">
          <ErrorBlock message={error} onRetry={() => load()} />
        </div>
      </>
    );
  }

  if (!queue) {
    return (
      <>
        <Topbar title="Review queue" />
        <div className="p-6">
          <LoadingBlock label="Loading queue" rows={3} />
        </div>
      </>
    );
  }

  const circular = active?.circularId || {};
  const grounding = active?.fieldGrounding || [];
  const spans = grounding
    .filter((f) => f.grounded && typeof f.start === "number")
    .map((f) => ({ field: f.field, start: f.start, end: f.end }));

  return (
    <>
      <Topbar
        title="Review queue"
        subtitle="Only grounded, confirmed obligations reach SME owners"
      />

      {!queue.length ? (
        <div className="p-6">
          <EmptyState
            title="Queue clear"
            body="Nothing is waiting for a decision. New low-confidence extractions will appear here."
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-5">
          {/* Queue list */}
          <div className="border-r border-black/5 lg:col-span-2">
            {summary ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-black/5 bg-white/60 px-5 py-3 text-xs text-ink/55">
                <span>
                  <span className="font-semibold text-ink">{summary.total}</span> waiting
                </span>
                <span>
                  <span className="font-semibold text-rose-700">{summary.blockedByGrounding}</span>{" "}
                  blocked by grounding
                </span>
                <span>
                  <span className="font-semibold text-amber-700">{summary.lowConfidence}</span> low
                  confidence
                </span>
              </div>
            ) : null}

            <div className="max-h-[calc(100vh-11rem)] overflow-y-auto">
              {queue.map((item) => {
                const blocked = (item.fieldGrounding || []).some(
                  (f) => ["effectiveDate", "penalty"].includes(f.field) && !f.grounded
                );
                return (
                  <button
                    key={item._id}
                    onClick={() => setActive(item)}
                    className={`block w-full border-b border-black/5 px-5 py-4 text-left ${
                      active?._id === item._id ? "bg-white" : "hover:bg-white/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{item.obligationType}</p>
                      <StatusBadge status={item.reviewStatus} />
                    </div>
                    <p className="mt-1 text-xs text-ink/45">{item.businessCategory}</p>
                    {blocked ? (
                      <p className="mt-1 text-xs font-semibold text-rose-700">
                        Ungrounded field — cannot auto-publish
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <ConfidenceMeter value={item.confidence} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comparison */}
          <div className="space-y-4 p-6 lg:col-span-3">
            {active ? (
              <>
                <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-xl text-ink">{active.obligationType}</h2>
                      <p className="bn mt-1 text-xs leading-6 text-ink/50">{circular.title}</p>
                    </div>
                    <VerificationBadges obligation={active} />
                  </div>
                  <p className="bn mt-3 leading-7 text-ink/85">{active.summaryBangla}</p>
                  {active.routingReason ? (
                    <p className="mt-3 rounded-xl bg-clay/50 px-3 py-2 text-xs leading-6 text-ink/60">
                      {active.routingReason}
                    </p>
                  ) : null}
                </div>

                {/* AI interpretation vs source document */}
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
                    <h3 className="font-display text-lg text-ink">AI interpretation</h3>
                    <p className="mt-0.5 mb-3 text-xs text-ink/45">
                      What the extraction engine proposed.
                    </p>

                    {grounding.length ? (
                      <ul className="space-y-2">
                        {grounding.map((f) => (
                          <li key={f.field}>
                            <button
                              onClick={() => setActiveField(f.field)}
                              className={`block w-full rounded-xl border px-3 py-2.5 text-left ${
                                activeField === f.field
                                  ? "border-forest-400 bg-forest-50"
                                  : f.grounded
                                    ? "border-black/5 bg-white hover:border-forest-200"
                                    : "border-rose-200 bg-rose-50/70"
                              }`}
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs text-ink/45">
                                  {FIELD_LABELS[f.field] || f.field}
                                </span>
                                <span
                                  className={
                                    f.grounded
                                      ? "text-xs text-emerald-700"
                                      : "text-xs font-semibold text-rose-700"
                                  }
                                >
                                  {f.grounded ? "grounded" : "not grounded"}
                                </span>
                              </div>
                              <p
                                className={`bn mt-1 text-sm leading-6 ${
                                  f.grounded ? "text-ink" : "text-rose-900"
                                }`}
                              >
                                {f.field === "effectiveDate"
                                  ? formatDate(f.extractedValue)
                                  : f.extractedValue || "— not extracted —"}
                              </p>
                              {f.grounded ? (
                                <p className="bn mt-1 text-xs leading-6 text-ink/50">
                                  Evidence: “{f.evidence}”
                                </p>
                              ) : (
                                <p className="mt-1 text-xs font-semibold text-rose-700">
                                  Not found in source — requires review
                                </p>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <p className="text-ink/70">
                          Category: <span className="text-ink">{active.businessCategory}</span>
                        </p>
                        <p className="text-ink/70">
                          Effective:{" "}
                          <span className="text-ink">{formatDate(active.effectiveDate)}</span>
                        </p>
                        <p className="bn text-ink/70">Penalty: {active.penalty}</p>
                        <p className="mt-2 rounded-lg bg-clay/60 px-3 py-2 text-xs leading-6 text-ink/55">
                          This obligation predates the grounding pipeline, so it has no per-field
                          evidence. Re-run its circular from Regulatory intelligence to generate one.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg text-ink">Source document</h3>
                      <span className="text-xs text-ink/45">{spans.length} highlighted</span>
                    </div>
                    <p className="mt-0.5 mb-3 text-xs text-ink/45">
                      The original circular, with matched evidence highlighted.
                    </p>
                    <SourceDocument
                      text={circular.documentText || ""}
                      spans={spans}
                      activeField={activeField}
                      onSelect={setActiveField}
                    />
                  </div>
                </div>

                {/* Decision */}
                <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">Your decision</p>
                      <p className="mt-0.5 text-xs text-ink/50">
                        Approving publishes alerts to every matching client. Rejecting publishes
                        nothing.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => decide("approve")}
                        disabled={busy}
                        className="rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50"
                      >
                        Approve and publish
                      </button>
                      <button
                        onClick={() => decide("reject")}
                        disabled={busy}
                        className="rounded-xl border border-rose-200 px-4 py-2 text-sm text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  {needsOverride ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                      <p className="text-sm font-semibold text-rose-900">
                        A critical field is not supported by the source text.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-rose-800/80">
                        ComplyBD will not publish this on its own. If you have checked the circular
                        and want to publish anyway, give a reason. It is recorded in the audit trail
                        under your name.
                      </p>
                      <textarea
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why is this safe to publish?"
                        className="mt-3 w-full rounded-xl border border-rose-200 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => decide("approve")}
                        disabled={busy || !reason.trim()}
                        className="mt-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-40"
                      >
                        Publish with override
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-4 border-t border-black/5 pt-3">
                    <HowVerificationWorks variant="link" />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
