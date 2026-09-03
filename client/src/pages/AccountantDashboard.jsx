import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import StatCard from "../components/StatCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import BarChart from "../components/BarChart.jsx";
import HowVerificationWorks from "../components/HowVerificationWorks.jsx";
import PipelineDiagram from "../components/PipelineDiagram.jsx";
import ComplianceFunnel from "../components/ComplianceFunnel.jsx";
import TrustPanel from "../components/TrustPanel.jsx";
import VerificationBadges from "../components/VerificationBadges.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { LoadingBlock, StatSkeleton, ErrorBlock } from "../components/StateViews.jsx";

/**
 * The accountant's home. The headline is not a metric but the compliance-changes
 * feed: which rules changed, who they touch, and whether each one has actually
 * been verified. Metrics sit above it as context, not as the point.
 */

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(value) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function DeadlineNote({ date }) {
  const days = daysUntil(date);
  if (days === null) return <span className="text-amber-700">No date stated</span>;
  if (days < 0) return <span className="text-ink/45">In force</span>;
  if (days <= 30) return <span className="font-semibold text-rose-700">in {days} days</span>;
  return <span className="text-ink/45">in {days} days</span>;
}

export default function AccountantDashboard() {
  const [data, setData] = useState(null);
  const [auditSummary, setAuditSummary] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api
      .get("/dashboard/accountant")
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.data?.message || err.message));

    // The trust panel reports the live chain state; a failure here should not
    // take down the dashboard, so it is fetched separately.
    api
      .get("/audit/summary")
      .then((res) => setAuditSummary(res.data))
      .catch(() => setAuditSummary(null));
  };

  useEffect(load, []);

  if (error) {
    return (
      <>
        <Topbar
          title="Bangla Regulatory Intelligence"
          subtitle="Verified compliance changes for your SME clients."
        />
        <div className="p-6">
          <ErrorBlock message={error} onRetry={load} />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Topbar
          title="Bangla Regulatory Intelligence"
          subtitle="Verified compliance changes for your SME clients."
        />
        <div className="space-y-6 p-6">
          <ComplianceFunnel loading />
          <StatSkeleton />
          <LoadingBlock label="Loading compliance changes" />
        </div>
      </>
    );
  }

  const changes = data.changes || [];

  return (
    <>
      <Topbar
        title="Bangla Regulatory Intelligence"
        subtitle="Verified compliance changes for your SME clients."
      />

      <div className="space-y-6 p-6">
        <ComplianceFunnel stats={data} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total SME clients"
            value={data.totalClients}
            hint={`${data.businesses.filter((b) => b.authorizationStatus === "authorized").length} authorized`}
          />
          <StatCard
            label="Regulatory changes"
            value={data.newRegulatoryChanges}
            hint="Circulars ingested"
            accent="brass"
          />
          <StatCard
            label="Alerts"
            value={data.totalAlerts}
            hint={`${data.openAlerts} open · ${data.urgentAlerts} urgent`}
          />
          <StatCard
            label="Needs review"
            value={data.requiresReview}
            hint="Held back from clients"
            accent="rose"
          />
        </div>

        <PipelineDiagram
          counts={{
            ai: `${data.newRegulatoryChanges} circulars`,
            review: `${data.requiresReview} waiting`,
            alert: `${data.totalAlerts} sent`,
            audit: auditSummary ? `${auditSummary.totalRecords} records` : null,
            anchor: auditSummary ? `${auditSummary.anchorCount} anchors` : null,
          }}
        />

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-ink">Compliance changes</h2>
              <p className="mt-0.5 text-sm text-ink/50">
                What changed, who it touches, and whether it has been verified.
              </p>
            </div>
            <HowVerificationWorks variant="link" />
          </div>

          {changes.length ? (
            <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-card">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-clay/50 text-xs text-forest-800">
                    <th className="px-4 py-3 font-semibold">Circular</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Obligation</th>
                    <th className="px-4 py-3 font-semibold">Effective</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Verification</th>
                    <th className="px-4 py-3 text-right font-semibold">Clients</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c._id} className="border-b border-black/5 align-top last:border-b-0 hover:bg-clay/30">
                      <td className="max-w-xs px-4 py-3">
                        <Link
                          to={`/obligations/${c._id}`}
                          className="bn block leading-6 text-ink hover:underline"
                        >
                          {c.circularTitle}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink/40">{c.source}</p>
                      </td>
                      <td className="px-4 py-3 text-ink/75">{c.businessCategory}</td>
                      <td className="px-4 py-3 text-ink/75">{c.obligationType}</td>
                      <td className="px-4 py-3">
                        <span className="block text-ink/75">{formatDate(c.effectiveDate)}</span>
                        <span className="mt-0.5 block text-xs">
                          <DeadlineNote date={c.effectiveDate} />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <VerificationBadges obligation={c} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.affectedClients > 0 ? (
                          <Link
                            to={`/obligations/${c._id}`}
                            className="tabular-nums font-semibold text-forest-800 underline underline-offset-2"
                          >
                            {c.affectedClients}
                          </Link>
                        ) : (
                          <span className="tabular-nums text-ink/35">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No compliance changes yet"
              body="Run a circular through the pipeline to extract obligations and match them to your clients."
              action={
                <Link
                  to="/intelligence"
                  className="inline-block rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white"
                >
                  Analyze a circular
                </Link>
              }
            />
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <BarChart
            title="Clients by category"
            data={(data.categoryBreakdown || []).map((c) => ({ label: c.category, value: c.count }))}
            emptyLabel="No clients on your books yet."
          />

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-ink">Clients</h3>
              <Link to="/accountant/clients" className="text-sm text-forest-700 underline underline-offset-2">
                Manage
              </Link>
            </div>
            <div className="mt-3 space-y-1">
              {data.businesses.slice(0, 6).map((b) => (
                <Link
                  key={b._id}
                  to={`/accountant/clients/${b._id}`}
                  className="flex items-start justify-between gap-3 rounded-xl px-3 py-2 hover:bg-clay/60"
                >
                  <span className="min-w-0">
                    <span className="bn block truncate text-sm font-medium text-ink">{b.name}</span>
                    <span className="block text-xs text-ink/45">
                      {b.category} · {b.location}
                    </span>
                  </span>
                  <StatusBadge status={b.authorizationStatus} />
                </Link>
              ))}
            </div>
          </div>

          <TrustPanel summary={auditSummary} />
        </div>
      </div>
    </>
  );
}
