import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { LoadingBlock, ErrorBlock } from "../components/StateViews.jsx";

const CATEGORIES = [
  "Restaurant",
  "Retail Shop",
  "Electronics Shop",
  "Clothing Business",
  "Small Manufacturer",
];

const HEALTH = {
  action_needed: "bg-rose-50 text-rose-800 ring-rose-200",
  attention: "bg-amber-50 text-amber-800 ring-amber-200",
  clear: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

function HealthPill({ health }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
        HEALTH[health.status] || HEALTH.clear
      }`}
    >
      {health.label}
    </span>
  );
}

function relative(value) {
  if (!value) return "No alerts yet";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ClientsPage() {
  const [params, setParams] = useSearchParams();
  const [clients, setClients] = useState(null);
  const [error, setError] = useState(null);

  const category = params.get("category") || "";
  const alertStatus = params.get("alerts") || "";
  const urgency = params.get("urgency") || "";

  const load = () => {
    setError(null);
    api
      .get("/dashboard/clients")
      .then((res) => setClients(res.data.clients))
      .catch((err) => setError(err?.response?.data?.message || err.message));
  };

  useEffect(load, []);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c) => {
      if (category && c.category !== category) return false;
      if (alertStatus === "active" && c.activeAlerts === 0) return false;
      if (alertStatus === "clear" && c.activeAlerts > 0) return false;
      if (urgency === "urgent" && c.urgentAlerts === 0) return false;
      return true;
    });
  }, [clients, category, alertStatus, urgency]);

  const hasFilters = Boolean(category || alertStatus || urgency);

  return (
    <>
      <Topbar title="Clients" subtitle="Every SME on your books and where each one stands" />

      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-card">
          <label className="min-w-[10rem]">
            <span className="text-xs text-ink/45">Category</span>
            <select
              value={category}
              onChange={(e) => setFilter("category", e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[10rem]">
            <span className="text-xs text-ink/45">Alert status</span>
            <select
              value={alertStatus}
              onChange={(e) => setFilter("alerts", e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="active">Has active alerts</option>
              <option value="clear">Nothing outstanding</option>
            </select>
          </label>

          <label className="min-w-[10rem]">
            <span className="text-xs text-ink/45">Urgency</span>
            <select
              value={urgency}
              onChange={(e) => setFilter("urgency", e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="urgent">Urgent only</option>
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

          {clients ? (
            <span className="ml-auto text-xs text-ink/45">
              {filtered.length} of {clients.length} clients
            </span>
          ) : null}
        </div>

        {error ? <ErrorBlock message={error} onRetry={load} /> : null}

        {!clients && !error ? <LoadingBlock label="Loading clients" rows={4} /> : null}

        {clients && !filtered.length ? (
          hasFilters ? (
            <EmptyState
              title="No clients match these filters"
              body="Widen the filters to see the rest of your book."
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
              title="No clients yet"
              body="Businesses assigned to you will appear here with their compliance status."
            />
          )
        ) : null}

        {filtered.length ? (
          <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-card">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-clay/50 text-xs text-forest-800">
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Compliance status</th>
                  <th className="px-4 py-3 text-right font-semibold">Active alerts</th>
                  <th className="px-4 py-3 font-semibold">Last updated</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c._id} className="border-b border-black/5 last:border-b-0 hover:bg-clay/30">
                    <td className="px-4 py-3">
                      <Link to={`/accountant/clients/${c._id}`} className="bn font-medium text-ink hover:underline">
                        {c.name}
                      </Link>
                      <span className="mt-0.5 block text-xs text-ink/40">BIN {c.vatBin || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-ink/75">{c.category}</td>
                    <td className="bn px-4 py-3 text-ink/70">{c.location}</td>
                    <td className="px-4 py-3">
                      <HealthPill health={c.health} />
                      {c.authorizationStatus !== "authorized" ? (
                        <span className="mt-1 block text-xs text-amber-700">
                          Authorization {c.authorizationStatus}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="tabular-nums font-semibold text-ink">{c.activeAlerts}</span>
                      {c.urgentAlerts ? (
                        <span className="ml-1 text-xs font-semibold text-rose-700">
                          ({c.urgentAlerts} urgent)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink/60">{relative(c.lastUpdated)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/accountant/clients/${c._id}`}
                        className="rounded-lg border border-black/10 px-3 py-1.5 text-xs text-ink/70 hover:bg-clay"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {clients && !clients.length ? null : (
          <p className="text-xs text-ink/40">
            Compliance status is derived from open alerts, so it updates the moment an alert is
            acknowledged or resolved.
          </p>
        )}
      </div>
    </>
  );
}
