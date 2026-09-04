import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import PipelineDiagram from "../components/PipelineDiagram.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { LoadingBlock, ErrorBlock } from "../components/StateViews.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Blockchain anchoring.
 *
 * The chain does one job here: publish a digest that commits to the audit trail,
 * so tampering stays detectable even if the database is rewritten. Everything
 * else — extraction, grounding, review, alerts — happens off-chain.
 *
 * The page is explicit about which mode produced each anchor. A simulated
 * anchor is labelled as one wherever it appears; nothing claims to be a live
 * transaction unless one was actually broadcast.
 */

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AnchorCard({ anchor, onVerify, verification }) {
  const isDemo = anchor.mode !== "testnet" && !anchor.submitted;

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
              isDemo
                ? "bg-violet-50 text-violet-900 ring-violet-200"
                : "bg-emerald-50 text-emerald-900 ring-emerald-200"
            }`}
          >
            ⛓ {anchor.label || (isDemo ? "Prototype blockchain anchor" : "Testnet anchor")}
          </span>
          <p className="mt-2 text-xs text-ink/45">{anchor.network || anchor.chain}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          {anchor.status || "anchored"}
        </span>
      </div>

      <dl className="mt-4 space-y-2.5 text-xs">
        <div>
          <dt className="text-ink/45">Anchor ID</dt>
          <dd className="mt-0.5 break-all font-mono text-[11px] text-ink/80">
            {anchor.anchorId || anchor.txHash}
          </dd>
        </div>
        <div>
          <dt className="text-ink/45">Committed hash</dt>
          <dd className="mt-0.5 break-all font-mono text-[11px] text-ink/70">
            {anchor.committedHash || anchor.merkleRoot}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="text-ink/45">Anchored at</dt>
            <dd className="mt-0.5 text-ink/75">{formatTime(anchor.anchoredAt)}</dd>
          </div>
          <div>
            <dt className="text-ink/45">Records covered</dt>
            <dd className="mt-0.5 tabular-nums text-ink/75">
              {anchor.entryCount}
              {anchor.entryCountTotal ? ` of ${anchor.entryCountTotal}` : ""}
            </dd>
          </div>
        </div>
      </dl>

      {anchor.note ? (
        <p className="mt-3 rounded-lg bg-clay/60 px-3 py-2 text-[11px] leading-5 text-ink/55">
          {anchor.note}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => onVerify(anchor)}
          className="rounded-lg border border-black/10 px-3 py-1.5 text-xs text-ink/70 hover:bg-clay"
        >
          Verify this anchor
        </button>
        {anchor.explorerUrl ? (
          <a
            href={anchor.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-forest-700 underline underline-offset-2"
          >
            View on explorer
          </a>
        ) : null}
      </div>

      {verification ? (
        <p
          className={`mt-2 text-xs leading-5 ${
            verification.valid ? "text-emerald-800" : "text-rose-800"
          }`}
        >
          {verification.valid ? "✓" : "⚠"} {verification.reason}
        </p>
      ) : null}
    </div>
  );
}

export default function BlockchainPage() {
  const { push } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [verifications, setVerifications] = useState({});

  const canAnchor = user?.role === "accountant" || user?.role === "reviewer";

  const load = () => {
    setError(null);
    api
      .get("/blockchain/status")
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.message || err.message));
  };

  useEffect(load, []);

  const anchorNow = async () => {
    setBusy(true);
    try {
      const res = await api.post("/blockchain/anchor");
      push(`${res.data.anchor.label} created`);
      load();
    } catch (err) {
      push(err?.response?.data?.message || "Could not anchor", "error");
    } finally {
      setBusy(false);
    }
  };

  const verifyAnchor = async (anchor) => {
    try {
      const res = await api.get(`/blockchain/anchors/${anchor._id}/verify`);
      setVerifications((v) => ({ ...v, [anchor._id]: res.data.result }));
    } catch (err) {
      push(err?.response?.data?.message || "Could not verify", "error");
    }
  };

  if (error) {
    return (
      <>
        <Topbar title="Blockchain anchors" />
        <div className="p-6">
          <ErrorBlock message={error} onRetry={load} />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Topbar title="Blockchain anchors" />
        <div className="p-6">
          <LoadingBlock label="Loading anchor status" rows={2} />
        </div>
      </>
    );
  }

  const svc = data.service;

  return (
    <>
      <Topbar
        title="Blockchain anchors"
        subtitle="Tamper evidence for what guidance was published, and when"
      />

      <div className="space-y-5 p-6">
        {/* Honest mode disclosure, first thing on the page. */}
        <div
          className={`rounded-2xl border p-5 ${
            svc.live
              ? "border-emerald-200 bg-emerald-50/70"
              : "border-violet-200 bg-violet-50/70"
          }`}
        >
          <p className="flex items-center gap-2 font-display text-xl text-ink">
            <span aria-hidden="true">⛓</span>
            {svc.label}
          </p>
          <p className="mt-1 text-sm leading-6 text-ink/70">{svc.disclosure}</p>
          {!svc.live ? (
            <p className="mt-2 text-xs leading-5 text-ink/50">{svc.configHint}</p>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg text-ink">Current state</h2>
                <p className="mt-0.5 text-xs text-ink/50">
                  One anchor commits to the entire audit trail up to that moment.
                </p>
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

            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink/45">Audit records</dt>
                <dd className="mt-0.5 font-display text-2xl tabular-nums text-ink">
                  {data.auditRecords}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink/45">Anchors</dt>
                <dd className="mt-0.5 font-display text-2xl tabular-nums text-ink">
                  {data.anchorCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink/45">Unanchored</dt>
                <dd className="mt-0.5 font-display text-2xl tabular-nums text-ink">
                  {data.unanchoredRecords}
                </dd>
              </div>
              <div className="sm:col-span-3">
                <dt className="text-xs text-ink/45">Latest audit hash</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-ink/75">
                  {data.latestAuditHash}
                </dd>
              </div>
              <div className="sm:col-span-3">
                <dt className="text-xs text-ink/45">Chain status</dt>
                <dd
                  className={`mt-0.5 text-sm font-semibold ${
                    data.chainIntact ? "text-emerald-800" : "text-rose-800"
                  }`}
                >
                  {data.chainIntact ? "✓ Audit chain intact" : "⚠ Audit chain integrity compromised"}
                </dd>
              </div>
            </dl>

            <Link
              to="/audit"
              className="mt-4 inline-block text-sm text-forest-700 underline underline-offset-2"
            >
              Open the audit trail
            </Link>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
            <h2 className="font-display text-lg text-ink">Why anchor at all</h2>
            <p className="mt-2 text-xs leading-6 text-ink/60">
              The audit trail is already hash-chained, so editing a record breaks every hash after
              it. But someone with database access could rewrite the whole chain and it would look
              consistent again.
            </p>
            <p className="mt-2 text-xs leading-6 text-ink/60">
              Publishing one digest somewhere they do not control removes that option. If the
              rebuilt chain no longer matches the anchored hash, the tampering is evident.
            </p>
            <p className="mt-2 text-xs leading-6 text-ink/60">
              Only a 32-byte hash is ever published. No circular text, no business data, no client
              names.
            </p>
          </div>
        </div>

        <PipelineDiagram />

        <section>
          <h2 className="mb-3 font-display text-xl text-ink">Anchor history</h2>
          {data.anchors.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.anchors.map((a) => (
                <AnchorCard
                  key={a._id}
                  anchor={a}
                  onVerify={verifyAnchor}
                  verification={verifications[a._id]}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No anchors yet"
              body="Create one to publish a digest committing to every audit record so far."
              action={
                canAnchor ? (
                  <button
                    onClick={anchorNow}
                    disabled={busy}
                    className="rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Create blockchain anchor
                  </button>
                ) : null
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
