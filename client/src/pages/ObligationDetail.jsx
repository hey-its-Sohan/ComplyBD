import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import VerificationBadges from "../components/VerificationBadges.jsx";
import TrustIndicators from "../components/TrustIndicators.jsx";
import HowVerificationWorks from "../components/HowVerificationWorks.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { LoadingBlock, ErrorBlock } from "../components/StateViews.jsx";

/**
 * One regulatory change, opened from the dashboard.
 *
 * This is the middle of the accountant's path: from "a rule changed" to the
 * words in the circular that establish it, to the specific clients it reached.
 * Without this page the dashboard is a dead end.
 */

const FIELD_LABELS = {
  businessCategory: "Affected category",
  obligationType: "Obligation type",
  effectiveDate: "Effective date",
  penalty: "Penalty",
};

function formatDate(value, fallback = "— not extracted —") {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function HighlightedSource({ text, spans, activeField, onSelect }) {
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
    <pre className="bn max-h-[28rem] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-clay/40 p-4 font-sans text-sm leading-8 text-ink/85">
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

export default function ObligationDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeField, setActiveField] = useState(null);

  const load = () => {
    setError(null);
    setData(null);
    api
      .get(`/obligations/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.message || err.message));
  };

  useEffect(load, [id]);

  if (error) {
    return (
      <>
        <Topbar title="Regulatory change" />
        <div className="p-6">
          <ErrorBlock message={error} onRetry={load} />
          <Link to="/accountant" className="mt-4 inline-block text-sm text-forest-700 underline">
            Back to dashboard
          </Link>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Topbar title="Regulatory change" />
        <div className="p-6">
          <LoadingBlock label="Loading obligation" rows={3} />
        </div>
      </>
    );
  }

  const { obligation: ob, circular, documentText, affectedClients, pendingMatches, versions = [] } = data;
  const grounding = ob.fieldGrounding || [];
  const spans = (
    grounding.length
      ? grounding.filter((f) => f.grounded && typeof f.start === "number")
      : ob.sourceSpans || []
  ).map((f) => ({ field: f.field, start: f.start, end: f.end }));

  return (
    <>
      <Topbar title={ob.obligationType} subtitle={`${ob.businessCategory} · ${circular?.source || "NBR"}`} />

      <div className="space-y-5 p-6">
        <Link to="/accountant" className="inline-block text-sm text-forest-700 underline underline-offset-2">
          ← Dashboard
        </Link>

        <Disclaimer />

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="bn font-display text-xl leading-relaxed text-ink">{circular?.title}</p>
              <p className="mt-1 text-xs text-ink/45">
                Effective {formatDate(ob.effectiveDate, "date not stated")}
                {circular?.sourceUrl ? (
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
              </p>
            </div>
            <VerificationBadges obligation={ob} />
          </div>

          <div className="mt-3">
            <TrustIndicators obligation={ob} anchored={Boolean(ob.publishedAt)} />
          </div>

          <p className="bn mt-4 leading-7 text-ink/85">{ob.summaryBangla}</p>
          {ob.requiredAction ? (
            <p className="bn mt-3 rounded-xl bg-clay/50 px-4 py-3 text-sm leading-7 text-ink/85">
              {ob.requiredAction}
            </p>
          ) : null}
          {ob.routingReason ? (
            <p className="mt-3 text-xs leading-6 text-ink/50">{ob.routingReason}</p>
          ) : null}
        </div>

        {/* Section 8: source transparency. An AI summary is never shown without
            the provenance that lets a reader go check it themselves. */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
          <h2 className="font-display text-lg text-ink">Source</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink/45">Source</dt>
              <dd className="mt-0.5 text-sm text-ink/85">{circular?.source || "NBR"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink/45">Circular</dt>
              <dd className="bn mt-0.5 text-sm leading-6 text-ink/85">{circular?.title || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink/45">Published</dt>
              <dd className="mt-0.5 text-sm text-ink/85">
                {formatDate(circular?.publishedDate, "not stated")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink/45">Effective</dt>
              <dd className="mt-0.5 text-sm text-ink/85">
                {formatDate(ob.effectiveDate, "not stated in the circular")}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-ink/45">Source URL</dt>
              <dd className="mt-0.5 text-sm">
                {circular?.sourceUrl ? (
                  <a
                    href={circular.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-forest-700 underline underline-offset-2"
                  >
                    {circular.sourceUrl}
                  </a>
                ) : (
                  <span className="text-ink/45">Not recorded</span>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-ink/45">Evidence</dt>
              <dd className="mt-1 space-y-1.5">
                {grounding.filter((f) => f.grounded && f.evidence).length ? (
                  grounding
                    .filter((f) => f.grounded && f.evidence)
                    .map((f) => (
                      <p key={f.field} className="text-sm leading-7">
                        <span className="text-xs text-ink/45">
                          {FIELD_LABELS[f.field] || f.field}:{" "}
                        </span>
                        <span className="bn rounded bg-amber-200/70 px-1 py-0.5 text-ink">
                          {f.evidence}
                        </span>
                      </p>
                    ))
                ) : ob.evidenceText ? (
                  <p className="bn text-sm leading-7 text-ink/85">{ob.evidenceText}</p>
                ) : (
                  <p className="text-sm text-ink/45">
                    No verbatim evidence recorded for this obligation.
                  </p>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-ink/45">Verification</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={
                    ob.groundingStatus === "grounded"
                      ? "font-semibold text-emerald-800"
                      : "font-semibold text-amber-800"
                  }
                >
                  {ob.groundingStatus === "grounded"
                    ? "Grounded in source"
                    : ob.groundingStatus === "partial"
                      ? "Partially grounded"
                      : "Not grounded"}
                </span>
                <span className="text-ink/30">·</span>
                <span
                  className={
                    ob.verifiedBy && !ob.autoVerified
                      ? "font-semibold text-sky-800"
                      : "text-ink/55"
                  }
                >
                  {ob.verifiedBy && !ob.autoVerified
                    ? `Human reviewed by ${ob.verifiedBy?.name || "a reviewer"}`
                    : ob.autoVerified
                      ? "Auto-verified — every checked field found in the source"
                      : "Awaiting human review"}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Evidence: the claim beside the words that support it. */}
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
            <h2 className="font-display text-lg text-ink">Extracted fields</h2>
            <p className="mt-0.5 mb-3 text-xs text-ink/45">
              Select a field to locate it in the circular.
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
                      <p className={`bn mt-1 text-sm leading-6 ${f.grounded ? "text-ink" : "text-rose-900"}`}>
                        {f.field === "effectiveDate" ? formatDate(f.extractedValue) : f.extractedValue || "— not extracted —"}
                      </p>
                      {f.grounded ? (
                        <p className="bn mt-1 text-xs leading-6 text-ink/50">Evidence: “{f.evidence}”</p>
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
                  Category: <span className="text-ink">{ob.businessCategory}</span>
                </p>
                <p className="text-ink/70">
                  Effective: <span className="text-ink">{formatDate(ob.effectiveDate)}</span>
                </p>
                <p className="bn text-ink/70">Penalty: {ob.penalty}</p>
                <p className="mt-2 rounded-lg bg-clay/60 px-3 py-2 text-xs leading-6 text-ink/55">
                  This obligation predates the grounding pipeline, so it has no per-field evidence.
                  Re-run its circular from Regulatory intelligence to generate one.
                </p>
              </div>
            )}

            <div className="mt-4 border-t border-black/5 pt-3">
              <HowVerificationWorks variant="link" />
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Source circular</h2>
              <span className="text-xs text-ink/45">{spans.length} highlighted</span>
            </div>
            <p className="mt-0.5 mb-3 text-xs text-ink/45">
              Highlights sit at the character positions recorded during grounding.
            </p>
            <HighlightedSource
              text={documentText || ""}
              spans={spans}
              activeField={activeField}
              onSelect={setActiveField}
            />
          </div>
        </div>

        {/* Section 5: versioned compliance record */}
        <section>
          <h2 className="mb-1 font-display text-xl text-ink">Version history</h2>
          <p className="mb-3 text-sm text-ink/50">
            Corrections append a new version. Nothing that was previously published is overwritten.
          </p>

          {versions.length ? (
            <ol className="space-y-2">
              {versions
                .slice()
                .reverse()
                .map((v) => (
                  <li
                    key={v._id}
                    className={`rounded-2xl border p-4 shadow-card ${
                      v.version === ob.version
                        ? "border-forest-200 bg-forest-50/50"
                        : "border-black/5 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          Version {v.version}
                          {v.version === ob.version ? (
                            <span className="ml-2 rounded-full bg-forest-100 px-2 py-0.5 text-[11px] font-semibold text-forest-800">
                              current
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-ink/50">
                          {v.changeType === "extracted" ? "AI extracted" : null}
                          {v.changeType === "verified" ? "Human verified · published" : null}
                          {v.changeType === "rejected" ? "Rejected · not published" : null}
                          {v.changeType === "edited" ? "Edited" : null}
                          {v.changeType === "reprocessed" ? "Reprocessed" : null}
                          {" · "}
                          <span className="bn">{v.actorName || v.actorId?.name || "system"}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs tabular-nums text-ink/45">
                          {new Date(v.createdAt).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {typeof v.confidence === "number" ? (
                          <p className="mt-0.5 text-xs tabular-nums text-ink/55">
                            {v.confidence}% confidence
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {v.changeNote ? (
                      <p className="mt-2 text-xs leading-6 text-ink/60">{v.changeNote}</p>
                    ) : null}

                    {v.auditHash ? (
                      <p className="mt-2 break-all font-mono text-[10px] text-ink/35">
                        audit {v.auditHash.slice(0, 24)}…
                      </p>
                    ) : null}
                  </li>
                ))}
            </ol>
          ) : (
            <EmptyState
              title="No version history"
              body="This obligation predates versioning. Re-run its circular to start a history."
            />
          )}

          {ob.publishedAt ? (
            <p className="mt-3 text-xs text-ink/45">
              First published{" "}
              {new Date(ob.publishedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {ob.pipelineVersion ? ` · pipeline v${ob.pipelineVersion}` : ""}
            </p>
          ) : null}
        </section>

        {/* Who it reached */}
        <section>
          <h2 className="mb-1 font-display text-xl text-ink">Affected clients</h2>
          <p className="mb-3 text-sm text-ink/50">
            {affectedClients.length
              ? `${affectedClients.length} of your clients received this alert.`
              : "No alerts have been published for this obligation."}
          </p>

          {affectedClients.length ? (
            <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-card">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-clay/50 text-xs text-forest-800">
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">Location</th>
                    <th className="px-4 py-3 font-semibold">Urgency</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {affectedClients.map((c) => (
                    <tr key={c.alertId} className="border-b border-black/5 last:border-b-0 hover:bg-clay/30">
                      <td className="px-4 py-3">
                        <Link
                          to={`/accountant/clients/${c.businessId}`}
                          className="bn font-medium text-ink hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="bn px-4 py-3 text-ink/70">{c.location}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/alerts/${c.alertId}`}
                          className="rounded-lg border border-black/10 px-3 py-1.5 text-xs text-ink/70 hover:bg-clay"
                        >
                          View alert
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nothing published yet"
              body={
                ob.reviewStatus === "verified"
                  ? "No client on your books falls into this category."
                  : "This obligation has not been verified, so no alert has been sent to any business."
              }
              action={
                ob.reviewStatus !== "verified" ? (
                  <Link
                    to={`/review?focus=${ob._id}`}
                    className="inline-block rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Open in review queue
                  </Link>
                ) : null
              }
            />
          )}

          {pendingMatches.length ? (
            <p className="mt-3 text-xs leading-6 text-ink/50">
              {pendingMatches.length} further client
              {pendingMatches.length === 1 ? "" : "s"} in this category
              {pendingMatches.length === 1 ? " is" : " are"} not receiving it:{" "}
              <span className="bn">{pendingMatches.map((p) => p.name).join(", ")}</span>. Alerts are
              only sent from verified obligations to authorized businesses.
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
