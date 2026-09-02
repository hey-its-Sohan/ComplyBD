import { useEffect, useState } from "react";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import StatCard from "../components/StatCard.jsx";
import AlertCard from "../components/AlertCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function AccountantDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/accountant").then((res) => setData(res.data));
  }, []);

  if (!data) {
    return (
      <>
        <Topbar title="Accountant desk" subtitle="Client compliance pulse" />
        <div className="p-6 text-ink/50">Loading…</div>
      </>
    );
  }

  const recent = data.alerts.slice(0, 6);

  return (
    <>
      <Topbar title="Accountant desk" subtitle="Client obligations, grounded against NBR circulars" />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total clients" value={data.totalClients} hint="Authorized SME books" />
          <StatCard label="New regulatory changes" value={data.newRegulatoryChanges} hint="Ingested circulars" accent="brass" />
          <StatCard label="Requires review" value={data.requiresReview} hint="Low-confidence AI drafts" accent="rose" />
          <StatCard label="Verified alerts" value={data.verifiedAlerts} hint="Released to owners" />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-3">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-xl">Recent compliance changes</h2>
              <p className="text-xs text-ink/45">{data.alerts.length} alerts across clients</p>
            </div>
            {recent.length ? (
              <div className="grid gap-3">
                {recent.map((a) => (
                  <AlertCard key={a._id} alert={a} />
                ))}
              </div>
            ) : (
              <EmptyState title="No alerts yet" body="Extract a circular to match obligations with client profiles." />
            )}
          </section>
          <section className="lg:col-span-2">
            <h2 className="mb-3 font-display text-xl">Client list</h2>
            <div className="space-y-2 rounded-2xl border border-black/5 bg-white p-3 shadow-card">
              {data.businesses.map((b) => (
                <div key={b._id} className="flex items-start justify-between rounded-xl px-3 py-2 hover:bg-clay/60">
                  <div>
                    <p className="bn font-medium">{b.name}</p>
                    <p className="text-xs text-ink/45">
                      {b.category} · {b.location}
                    </p>
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-forest-700">{b.authorizationStatus}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
