import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import StatCard from "../components/StatCard.jsx";
import AlertCard from "../components/AlertCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard/owner").then((res) => setData(res.data)).catch(() => navigate("/dashboard"));
  }, [navigate]);

  if (!data) {
    return (
      <>
        <Topbar title="আমার ব্যবসা" subtitle="Plain-language compliance" />
        <div className="p-6 text-ink/50">Loading…</div>
      </>
    );
  }

  return (
    <>
      <Topbar title="আমার ব্যবসা" subtitle="What changed, in Bangla — no legal jargon" />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="My shops" value={data.businesses.length} />
          <StatCard label="Open alerts" value={data.openAlerts} accent="rose" />
          <StatCard label="Total notices" value={data.alerts.length} accent="brass" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {data.businesses.map((b) => (
            <div key={b._id} className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
              <p className="bn text-lg font-semibold">{b.name}</p>
              <p className="mt-1 text-sm text-ink/50">
                {b.category} · {b.location}
              </p>
              <p className="mt-3 text-xs text-ink/40">BIN {b.vatBin}</p>
            </div>
          ))}
        </div>
        <section>
          <h2 className="mb-3 font-display text-xl">সতর্কতা</h2>
          {data.alerts.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {data.alerts.map((a) => (
                <AlertCard key={a._id} alert={a} />
              ))}
            </div>
          ) : (
            <EmptyState title="কোনো সতর্কতা নেই" body="নতুন পরিপত্র মিললে এখানে বাংলায় দেখাবে।" />
          )}
        </section>
      </div>
    </>
  );
}
