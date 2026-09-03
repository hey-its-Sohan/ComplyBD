import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import PipelineStepper from "../components/PipelineStepper.jsx";
import GroundingTable from "../components/GroundingTable.jsx";
import SplitSourceViewer from "../components/SplitSourceViewer.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * The page that shows the product's actual argument: an AI proposal is not
 * trusted until a deterministic check finds it in the source document.
 *
 * The staged reveal is deliberate. The backend returns the whole result in one
 * response, but replaying it stage by stage is what makes the pipeline legible
 * to someone watching for the first time — and each stage shows the real timing
 * and the real detail line the server recorded, not a decorative animation.
 */

const STAGE_DELAY_MS = 620;

const BAND_STYLES = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-900",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  low: "border-rose-200 bg-rose-50 text-rose-900",
};

function ConfidenceSummary({ confidence, groundingScore }) {
  const band = confidence.band;
  const parts = confidence.components || {};

  return (
    <div className={`rounded-2xl border p-5 ${BAND_STYLES[band] || BAND_STYLES.low}`}>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-4xl tabular-nums">{confidence.score}%</span>
        <span className="text-sm font-semibold capitalize">{band} confidence</span>
      </div>

      <dl className="mt-4 space-y-1.5 text-xs">
        <div className="flex justify-between gap-4">
          <dt className="opacity-70">Model self-reported</dt>
          <dd className="tabular-nums font-semibold">{parts.aiConfidence}%</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="opacity-70">Deterministic grounding</dt>
          <dd className="tabular-nums font-semibold">{Math.round((groundingScore || 0) * 100)}%</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="opacity-70">Evidence completeness</dt>
          <dd className="tabular-nums font-semibold">{parts.evidenceCompleteness}%</dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-1.5 border-t border-black/10 pt-3 text-xs leading-5 opacity-80">
        {confidence.reasons.map((reason, i) => (
          <li key={i}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}

export default function RegulatoryIntelligence() {
  const { push } = useToast();
  const { user } = useAuth();

  const [config, setConfig] = useState(null);
  const [circulars, setCirculars] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState(null);
  const [visibleSteps, setVisibleSteps] = useState([]);
  const [running, setRunning] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [needsOverride, setNeedsOverride] = useState(false);
  const [busy, setBusy] = useState(false);

  const canRun = user?.role === "accountant" || user?.role === "reviewer";

  useEffect(() => {
    api
      .get("/pipeline/config")
      .then((res) => setConfig(res.data))
      .catch(() => setConfig(null));

    api.get("/circulars").then((res) => {
      setCirculars(res.data);
      // Prefer a circular that has not been processed yet — that is the live demo.
      const fresh = res.data.find((c) => c.status === "ingested");
      setSelectedId((prev) => prev || (fresh || res.data[0] || {})._id || "");
    });
  }, []);

  const selected = useMemo(
    () => circulars.find((c) => c._id === selectedId) || null,
    [circulars, selectedId]
  );

  const analyze = async () => {
    if (!selectedId) return;
    setRunning(true);
    setResult(null);
    setVisibleSteps([]);
    setActiveField(null);
    setNeedsOverride(false);
    setOverrideReason("");

    try {
      const res = await api.post(`/circulars/${selectedId}/process`);
      const data = res.data;

      // Replay the recorded trace one stage at a time.
      for (let i = 0; i < data.trace.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, STAGE_DELAY_MS));
        setVisibleSteps(data.trace.slice(0, i + 1));
      }

      setResult(data);
      setActiveField(data.fieldTable[0]?.field || null);
      setCirculars((list) =>
        list.map((c) => (c._id === selectedId ? { ...c, status: "extracted" } : c))
      );

      if (data.routing.reviewStatus === "verified") {
        push(`Verified — ${data.alertsCreated} alert(s) dispatched`);
      } else {
        push("Held for human review — a field could not be grounded", "error");
      }
    } catch (err) {
      push(err?.response?.data?.message || "Analysis failed", "error");
    } finally {
      setRunning(false);
    }
  };

  const decide = async (action) => {
    if (!result?.obligation?._id) return;
    setBusy(true);
    try {
      const body =
        action === "verify"
          ? { override: needsOverride, overrideReason }
          : { reason: overrideReason };
      const res = await api.post(`/obligations/${result.obligation._id}/${action}`, body);
      setResult((r) => ({ ...r, obligation: res.data.obligation }));
      setNeedsOverride(false);
      setOverrideReason("");
      push(
        action === "verify"
          ? `Verified — ${res.data.alertsCreated} alert(s) dispatched`
          : "Rejected — no alerts sent"
      );
    } catch (err) {
      const data = err?.response?.data;
      if (data?.requiresOverride) {
        setNeedsOverride(true);
        push(data.message, "error");
      } else {
        push(data?.message || "Could not update the obligation", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const steps = result?.steps || config?.steps || [];
  const rows = result?.fieldTable || [];
  const provider = config?.provider;
  const status = result?.obligation?.reviewStatus || result?.routing?.reviewStatus;

  return (
    <>
      <Topbar
        title="Regulatory Intelligence"
        subtitle="Extraction, grounding and review routing for a single circular"
      />

      <div className="space-y-5 p-6">
        <Disclaimer />

        {/* Engine status — judges should be able to see which engine produced a result. */}
        {provider ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-black/5 bg-white px-5 py-3.5 text-sm shadow-card">
            <span className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${provider.usingLiveModel ? "bg-emerald-500" : "bg-brass-400"}`}
              />
              <span className="text-ink/50">Extraction engine</span>
              <span className="font-semibold text-ink">{provider.activeLabel}</span>
            </span>
            <span className="text-ink/50">
              Grounding <span className="font-semibold text-ink">deterministic, no model</span>
            </span>
            <span className="text-ink/40">Pipeline v{config.pipelineVersion}</span>
            {provider.fallbackReason ? (
              <span className="text-xs text-ink/40">{provider.fallbackReason}</span>
            ) : null}
          </div>
        ) : null}

        {/* Circular picker */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1">
              <span className="text-xs text-ink/45">Circular</span>
              <select
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setResult(null);
                  setVisibleSteps([]);
                }}
                className="bn mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
              >
                {circulars.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.status === "ingested" ? "• " : ""}
                    {c.title}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={analyze}
              disabled={!selectedId || running || !canRun}
              className="rounded-xl bg-forest-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-700 disabled:cursor-not-allowed disabled:bg-forest-800/40"
            >
              {running ? "Analyzing…" : "Analyze circular"}
            </button>
          </div>

          {selected ? (
            <p className="mt-3 text-xs text-ink/45">
              {selected.source} ·{" "}
              {selected.publishedDate
                ? new Date(selected.publishedDate).toLocaleDateString()
                : "no publication date"}
              {selected.sourceUrl ? (
                <>
                  {" · "}
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-forest-700"
                  >
                    source
                  </a>
                </>
              ) : null}
            </p>
          ) : null}

          {!canRun ? (
            <p className="mt-3 text-xs text-ink/45">
              Sign in as an accountant or reviewer to run the pipeline.
            </p>
          ) : null}
        </div>

        {!result && !running && !circulars.length ? (
          <EmptyState
            title="No circulars to analyze"
            body="Ingest an NBR circular first, then run it through the pipeline."
            action={
              <Link to="/circulars" className="text-sm text-forest-700 underline">
                Go to circulars
              </Link>
            }
          />
        ) : null}

        {/* Pipeline + confidence */}
        {running || result ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card lg:col-span-2">
              <h3 className="font-display text-lg text-ink">Pipeline</h3>
              <div className="mt-4">
                <PipelineStepper steps={steps} trace={visibleSteps} running={running} />
              </div>
            </div>

            {result ? (
              <ConfidenceSummary
                confidence={result.confidence}
                groundingScore={result.overallGroundingScore}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-5">
                <p className="text-sm text-ink/40">Confidence appears once grounding completes.</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Outcome + decision */}
        {result ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/5 bg-white p-5 shadow-card">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={status} />
                  <StatusBadge status={result.obligation?.groundingStatus} />
                  {result.obligation?.autoVerified ? (
                    <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-800 ring-1 ring-forest-200">
                      Auto-verified
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
                  {result.obligation?.routingReason || result.routing.routingReason}
                </p>
              </div>

              {canRun && status !== "verified" && status !== "rejected" ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => decide("verify")}
                    disabled={busy}
                    className="rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50"
                  >
                    Verify and alert SMEs
                  </button>
                  <button
                    onClick={() => decide("reject")}
                    disabled={busy}
                    className="rounded-xl border border-rose-200 px-4 py-2 text-sm text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>

            {/* The override gate. Verification is refused until a person takes
                responsibility in writing, and the reason enters the audit log. */}
            {needsOverride ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
                <p className="text-sm font-semibold text-rose-900">
                  This obligation has a field that is not supported by the source text.
                </p>
                <p className="mt-1 text-xs leading-5 text-rose-800/80">
                  ComplyBD will not publish it on its own. If you have checked the circular and want
                  to publish anyway, give a reason. It is recorded in the audit trail under your
                  name.
                </p>
                <textarea
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Why is this safe to publish?"
                  className="mt-3 w-full rounded-xl border border-rose-200 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => decide("verify")}
                  disabled={busy || !overrideReason.trim()}
                  className="mt-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-40"
                >
                  Publish with override
                </button>
              </div>
            ) : null}

            <div>
              <h2 className="font-display text-xl text-ink">Field grounding</h2>
              <p className="mt-0.5 mb-3 text-sm text-ink/50">
                Every AI-proposed field, checked against the words of the circular.
              </p>
              <GroundingTable rows={rows} activeField={activeField} onSelect={setActiveField} />
            </div>

            <div>
              <h2 className="font-display text-xl text-ink">Source viewer</h2>
              <p className="mt-0.5 mb-3 text-sm text-ink/50">
                The obligation on the left, the circular it came from on the right.
              </p>
              <SplitSourceViewer
                documentText={result.circular.documentText}
                rows={rows}
                activeField={activeField}
                onSelectField={setActiveField}
                summaryBangla={result.obligation?.summaryBangla || result.extraction.summaryBangla}
                requiredAction={result.obligation?.requiredAction || result.extraction.requiredAction}
              />
            </div>

            {status !== "verified" ? (
              <Link to="/review" className="inline-block text-sm text-forest-700 underline">
                Open the review queue
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
