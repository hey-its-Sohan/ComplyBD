import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import AlertExplainer from "../components/AlertExplainer.jsx";
import HowVerificationWorks from "../components/HowVerificationWorks.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { LoadingBlock, ErrorBlock } from "../components/StateViews.jsx";

/**
 * Every alert across the accountant's book, written the way the owner will read
 * it. The accountant sees exactly what their client sees, plus the provenance.
 */

const PRIORITIES = [
  { value: "", label: "All urgencies" },
  { value: "high", label: "🔴 Urgent" },
  { value: "medium", label: "🟡 Important" },
  { value: "low", label: "🟢 Information" },
];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "seen", label: "Seen" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
];

export default function AlertCenter() {
  const [params, setParams] = useSearchParams();
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState(null);

  const priority = params.get("priority") || "";
  const status = params.get("status") || "";
  const business = params.get("business") || "";

  const load = () => {
    setError(null);
    api
      .get("/alerts")
      .then((res) => setAlerts(res.data))
      .catch((err) => setError(err?.response?.data?.message || err.message));
  };

  useEffect(load, []);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const businesses = useMemo(() => {
    if (!alerts) return [];
    const seen = new Map();
    alerts.forEach((a) => {
      if (a.businessId) seen.set(String(a.businessId._id), a.businessId.name);
    });
    return [...seen.entries()];
  }, [alerts]);

  const filtered = useMemo(() => {
    if (!alerts) return [];
    return alerts.filter((a) => {
      if (priority && a.priority !== priority) return false;
      if (status && a.status !== status) return false;
      if (business && String(a.businessId?._id) !== business) return false;
      return true;
    });
  }, [alerts, priority, status, business]);

  const hasFilters = Boolean(priority || status || business);

  return (
    <>
      <Topbar title="Alert center" subtitle="What your clients are being told, and why" />

      <div className="space-y-5 p-6">
        <Disclaimer />

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-card">
          <label className="min-w-[10rem]">
            <span className="text-xs text-ink/45">Urgency</span>
            <select
              value={priority}
              onChange={(e) => setFilter("priority", e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[10rem]">
            <span className="text-xs text-ink/45">Status</span>
            <select
              value={status}
              onChange={(e) => setFilter("status", e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[12rem]">
            <span className="text-xs text-ink/45">Client</span>
            <select
              value={business}
              onChange={(e) => setFilter("business", e.target.value)}
              className="bn mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              <option value="">All clients</option>
              {businesses.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {hasFilters ? (
            <button
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="rounded-xl border border-black/10 px-3 py-2 text-sm text-ink/60 hover:bg-clay"
            >
              Clear filters
            </button>
          ) : null}

          <div className="ml-auto flex items-center gap-4">
            {alerts ? (
              <span className="text-xs text-ink/45">
                {filtered.length} of {alerts.length} alerts
              </span>
            ) : null}
            <HowVerificationWorks variant="link" />
          </div>
        </div>

        {error ? <ErrorBlock message={error} onRetry={load} /> : null}
        {!alerts && !error ? <LoadingBlock label="Loading alerts" rows={3} /> : null}

        {alerts && !filtered.length ? (
          hasFilters ? (
            <EmptyState
              title="No alerts match these filters"
              body="Try widening the urgency or status filter."
              action={
                <button
                  onClick={() => setParams(new URLSearchParams(), { replace: true })}
                  className="rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <EmptyState
              title="No alerts published yet"
              body="Alerts appear here once a verified obligation matches one of your clients."
            />
          )
        ) : null}

        {filtered.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {filtered.map((a) => (
              <AlertExplainer key={a._id} alert={a} />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
