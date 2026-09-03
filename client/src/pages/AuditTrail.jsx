import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import PipelineDiagram from "../components/PipelineDiagram.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { LoadingBlock, ErrorBlock } from "../components/StateViews.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * The append-only compliance record.
 *
 * The verification banner is the point of the page: it is the result of
 * recomputing every hash in the chain, not a stored flag. If someone edited the
 * database directly, this is the screen that would say so.
 */

function shortHash(hash, size = 10) {
  if (!hash) return "—";
  if (hash === "GENESIS") return "GENESIS";
  return `${String(hash).slice(0, size)}…`;
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ChainBanner({ verification, onVerify, verifying }) {
  if (!verification) return null;
  const intact = verification.intact;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        intact ? "border-emerald-200 bg-emerald-50/70" : "border-rose-200 bg-rose-50/70"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`flex items-center gap-2 font-display text-xl ${
              intact ? "text-emerald-900" : "text-rose-900"
            }`}
          >
            <span aria-hidden="true">{intact ? "✓" : "⚠"}</span>
            {intact ? "Audit chain intact" : "Audit chain integrity compromised"}
          </p>
          <p className={`mt-1 text-sm ${intact ? "text-emerald-800/80" : "text-rose-800/80"}`}>
            {intact
              ? `All ${verification.checked} records recomputed and matched. Nothing has been edited, removed or reordered.`
              : `A problem was found at record ${verification.brokenAt}. ${verification.issues.length} issue(s) detected.`}
          </p>
        </div>

        <button
          onClick={onVerify}
          disabled={verifying}
          className="shrink-0 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink/75 hover:bg-clay disabled:opacity-50"
        >
          {verifying ? "Re-verifying…" : "Re-verify chain"}
        </button>
      </div>

      {!intact ? (
        <ul className="mt-3 space-y-1.5 border-t border-rose-200 pt-3">
          {verification.issues.slice(0, 6).map((issue, i) => (
            <li key={i} className="text-xs leading-5 text-rose-900">
              <span className="font-semibold">Record {issue.index}</span> ({issue.action}) —{" "}
              {issue.detail}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LogRow({ log, expanded, onToggle }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-black/5 align-top hover:bg-clay/30 ${
          expanded ? "bg-clay/40" : ""
        }`}
      >
        <td className="px-4 py-3 text-xs tabular-nums text-ink/55">
          <span className="mr-2 text-ink/30">#{log.sequence}</span>
          {formatTime(log.timestamp)}
        </td>
        <td className="px-4 py-3">
          <span className="font-medium text-ink">{log.actionLabel || log.action}</span>
          <span className="mt-0.5 block font-mono text-[10px] text-ink/35">{log.action}</span>
        </td>
        <td className="bn px-4 py-3 text-ink/70">
          {log.actor?.name || <span className="text-ink/35">system</span>}
          {log.actor?.role ? (
            <span className="mt-0.5 block text-[11px] text-ink/40">{log.actor.role}</span>
          ) : null}
        </td>
        <td className="px-4 py-3 text-ink/70">
          {log.entityType}
          {log.entityId ? (
            <span className="mt-0.5 block font-mono text-[10px] text-ink/35">
              {shortHash(log.entityId, 8)}
            </span>
          ) : null}
        </td>
        <td className="px-4 py-3 font-mono text-[11px] text-ink/60">{shortHash(log.currentHash)}</td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
            🔒 Logged
          </span>
        </td>
      </tr>

      {expanded ? (
        <tr className="border-b border-black/5 bg-clay/20">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-forest-800">Hash chain</p>
                <dl className="mt-2 space-y-1.5 text-xs">
                  <div>
                    <dt className="text-ink/45">Previous hash</dt>
                    <dd className="break-all font-mono text-[11px] text-ink/75">
                      {log.previousHash}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink/45">Current hash</dt>
                    <dd className="break-all font-mono text-[11px] text-ink/75">
                      {log.currentHash}
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <p className="text-xs font-semibold text-forest-800">Metadata</p>
                <pre className="mt-2 max-h-52 overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] leading-5 text-ink/75">
                  {JSON.stringify(log.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default function AuditTrail() {
  const { push } = useToast();
  const { user } = useAuth();
  const [logs, setLogs] = useState(null);
  const [summary, setSummary] = useState(null);
  const [actions, setActions] = useState([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const canAnchor = user?.role === "accountant" || user?.role === "reviewer";

  const load = async () => {
    setError(null);
    try {
      const [l, s, a] = await Promise.all([
        api.get("/audit"),
        api.get("/audit/summary"),
        api.get("/audit/actions"),
      ]);
      setLogs(l.data);
      setSummary(s.data);
      setActions(a.data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reverify = async () => {
    setVerifying(true);
    try {
      const res = await api.get("/audit/verify");
      setSummary((s) => ({ ...s, verification: res.data }));
      push(res.data.intact ? "Chain re-verified — intact" : "Chain verification failed", res.data.intact ? "success" : "error");
    } catch (err) {
      push(err?.response?.data?.message || "Verification failed", "error");
    } finally {
      setVerifying(false);
    }
  };

  const anchorNow = async () => {
    setBusy(true);
    try {
      const res = await api.post("/audit/anchor");
      setSummary(res.data.summary);
      push(`Anchored ${res.data.anchor.entryCount} record(s) — ${res.data.anchor.label}`);
      await load();
    } catch (err) {
      push(err?.response?.data?.message || "Could not anchor", "error");
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(
    () => (logs || []).filter((l) => !filter || l.action === filter),
    [logs, filter]
  );

  const latestAnchor = summary?.latestAnchor;

  return (
    <>
      <Topbar
        title="Audit trail"
        subtitle="Append-only hash chain · periodic tamper-evident anchors"
      />

      <div className="space-y-5 p-6">
        {error ? <ErrorBlock message={error} onRetry={load} /> : null}
        {!logs && !error ? <LoadingBlock label="Loading audit trail" rows={3} /> : null}

        {summary ? (
          <>
            <ChainBanner
              verification={summary.verification}
              onVerify={reverify}
              verifying={verifying}
            />

            {/* Section 4: the anchor panel */}
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg text-ink">Blockchain anchor</h2>
                    <p className="mt-0.5 text-xs text-ink/50">{summary.blockchain?.disclosure}</p>
                  </div>
                  {canAnchor ? (
                    <button
                      onClick={anchorNow}
                      disabled={busy}
                      className="shrink-0 rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50"
                    >
                      {busy ? "Anchoring…" : "Create blockchain anchor"}
                    </button>
                  ) : null}
                </div>

                <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-ink/45">Audit records</dt>
                    <dd className="mt-0.5 font-display text-2xl tabular-nums text-ink">
                      {summary.totalRecords}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink/45">Not yet anchored</dt>
                    <dd className="mt-0.5 font-display text-2xl tabular-nums text-ink">
                      {summary.unanchoredRecords}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-ink/45">Latest hash</dt>
                    <dd className="mt-0.5 break-all font-mono text-xs text-ink/75">
                      {summary.latestHash}
                    </dd>
                  </div>
                  {latestAnchor ? (
                    <>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-ink/45">Blockchain anchor</dt>
                        <dd className="mt-0.5 break-all font-mono text-xs text-ink/75">
                          {latestAnchor.anchorId || latestAnchor.txHash}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink/45">Anchored at</dt>
                        <dd className="mt-0.5 text-sm text-ink/75">
                          {formatTime(latestAnchor.anchoredAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink/45">Status</dt>
                        <dd className="mt-0.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-900 ring-1 ring-violet-200">
                            ⛓ {latestAnchor.label || "Anchored"}
                          </span>
                        </dd>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2">
                      <p className="rounded-lg bg-clay/60 px-3 py-2 text-xs leading-5 text-ink/55">
                        No anchor published yet. Creating one publishes a single digest that commits
                        to every record above.
                      </p>
                    </div>
                  )}
                </dl>

                <Link
                  to="/blockchain"
                  className="mt-4 inline-block text-sm text-forest-700 underline underline-offset-2"
                >
                  All anchors
                </Link>
              </div>

              <PipelineDiagram compact />
            </div>
          </>
        ) : null}

        {logs ? (
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-ink">Timeline</h2>
                <p className="mt-0.5 text-sm text-ink/50">
                  Select any row to see its hashes and metadata.
                </p>
              </div>
              <label>
                <span className="text-xs text-ink/45">Action</span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="mt-1 block rounded-xl border border-black/10 px-3 py-2 text-sm"
                >
                  <option value="">All actions</option>
                  {actions.map((a) => (
                    <option key={a.action} value={a.action}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {filtered.length ? (
              <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-card">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/5 bg-clay/50 text-xs text-forest-800">
                      <th className="px-4 py-3 font-semibold">Timestamp</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                      <th className="px-4 py-3 font-semibold">Actor</th>
                      <th className="px-4 py-3 font-semibold">Entity</th>
                      <th className="px-4 py-3 font-semibold">Hash</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((log) => (
                      <LogRow
                        key={log._id}
                        log={log}
                        expanded={expanded === log._id}
                        onToggle={() => setExpanded(expanded === log._id ? null : log._id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No records match"
                body="Try a different action filter."
                action={
                  <button
                    onClick={() => setFilter("")}
                    className="rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Clear filter
                  </button>
                }
              />
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}
