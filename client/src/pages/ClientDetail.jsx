import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import StatCard from "../components/StatCard.jsx";
import AlertExplainer from "../components/AlertExplainer.jsx";
import VerificationBadges from "../components/VerificationBadges.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { LoadingBlock, ErrorBlock } from "../components/StateViews.jsx";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const HEALTH_COPY = {
  action_needed: {
    tone: "border-rose-200 bg-rose-50/70 text-rose-900",
    line: "This client has an urgent alert that has not been opened yet.",
  },
  attention: {
    tone: "border-amber-200 bg-amber-50/70 text-amber-900",
    line: "There are open alerts waiting to be acknowledged.",
  },
  clear: {
    tone: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
    line: "Everything currently published has been acknowledged.",
  },
};

export default function ClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    setData(null);
    api
      .get(`/dashboard/clients/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.message || err.message));
  };

  useEffect(load, [id]);

  if (error) {
    return (
      <>
        <Topbar title="Client" />
        <div className="p-6">
          <ErrorBlock message={error} onRetry={load} />
          <Link to="/accountant/clients" className="mt-4 inline-block text-sm text-forest-700 underline">
            Back to clients
          </Link>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Topbar title="Client" />
        <div className="p-6">
          <LoadingBlock label="Loading client" rows={3} />
        </div>
      </>
    );
  }

  const { business, health, currentAlerts, historicalAlerts, obligations } = data;
  const healthCopy = HEALTH_COPY[health.status] || HEALTH_COPY.clear;

  return (
    <>
      <Topbar title={business.name} subtitle={`${business.category} · ${business.location}`} />

      <div className="space-y-6 p-6">
        <Link to="/accountant/clients" className="inline-block text-sm text-forest-700 underline underline-offset-2">
          ← All clients
        </Link>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card lg:col-span-2">
            <h2 className="font-display text-lg text-ink">Business profile</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ["Trading name", <span className="bn">{business.name}</span>],
                ["Category", business.category],
                ["Location", <span className="bn">{business.location}</span>],
                ["Owner", <span className="bn">{business.ownerId?.name || "—"}</span>],
                ["TIN", business.tin || "—"],
                ["VAT BIN", business.vatBin || "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-ink/45">{label}</dt>
                  <dd className="mt-0.5 text-sm text-ink/85">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs text-ink/45">Authorization</dt>
                <dd className="mt-1">
                  <StatusBadge status={business.authorizationStatus} />
                </dd>
              </div>
            </dl>
          </div>

          <div className={`rounded-2xl border p-5 ${healthCopy.tone}`}>
            <h2 className="font-display text-lg">Compliance health</h2>
            <p className="mt-2 text-2xl font-semibold">{health.label}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">{healthCopy.line}</p>
            <div className="mt-4 flex gap-4 border-t border-black/10 pt-3 text-sm">
              <span>
                <span className="tabular-nums font-semibold">{health.open}</span> open
              </span>
              <span>
                <span className="tabular-nums font-semibold">{health.urgent}</span> urgent
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Current alerts" value={currentAlerts.length} />
          <StatCard label="Relevant obligations" value={obligations.length} accent="brass" />
          <StatCard label="Alert history" value={historicalAlerts.length} />
        </div>

        <section>
          <h2 className="mb-3 font-display text-xl text-ink">Current alerts</h2>
          {currentAlerts.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {currentAlerts.map((a) => (
                <AlertExplainer key={a._id} alert={{ ...a, businessId: business }} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing outstanding"
              body="Every published change for this client has been acknowledged."
            />
          )}
        </section>

        <section>
          <h2 className="mb-1 font-display text-xl text-ink">Relevant obligations</h2>
          <p className="mb-3 text-sm text-ink/50">
            Every obligation matching the {business.category} category, including ones still held for
            review.
          </p>
          {obligations.length ? (
            <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-card">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-clay/50 text-xs text-forest-800">
                    <th className="px-4 py-3 font-semibold">Obligation</th>
                    <th className="px-4 py-3 font-semibold">Circular</th>
                    <th className="px-4 py-3 font-semibold">Effective</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {obligations.map((ob) => (
                    <tr key={ob._id} className="border-b border-black/5 align-top last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{ob.obligationType}</p>
                        <p className="bn mt-1 max-w-md text-xs leading-6 text-ink/55">
                          {ob.summaryBangla}
                        </p>
                      </td>
                      <td className="bn max-w-xs px-4 py-3 text-xs leading-6 text-ink/60">
                        {ob.circularId?.title || "—"}
                      </td>
                      <td className="px-4 py-3 text-ink/70">{formatDate(ob.effectiveDate)}</td>
                      <td className="px-4 py-3">
                        <VerificationBadges obligation={ob} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No obligations for this category yet" />
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-ink">Alert history</h2>
          {historicalAlerts.length ? (
            <ol className="space-y-2">
              {historicalAlerts.map((a) => (
                <li
                  key={a._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-4 py-3 shadow-card"
                >
                  <div className="min-w-0">
                    <p className="bn text-sm text-ink/85">{a.whatChanged || a.messageBangla}</p>
                    <p className="mt-0.5 text-xs text-ink/40">
                      Delivered {formatDate(a.deliveredAt)}
                      {a.acknowledgedAt ? ` · acknowledged ${formatDate(a.acknowledgedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={a.priority} />
                    <StatusBadge status={a.status} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No history yet" body="Acknowledged and resolved alerts collect here." />
          )}
        </section>
      </div>
    </>
  );
}
