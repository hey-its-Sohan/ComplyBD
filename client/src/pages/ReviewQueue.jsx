import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import ConfidenceMeter from "../components/ConfidenceMeter.jsx";
import SourceEvidence from "../components/SourceEvidence.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function ReviewQueue() {
  const { push } = useToast();
  const [params] = useSearchParams();
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);

  const load = async () => {
    const res = await api.get("/reviews");
    setQueue(res.data);
    const focus = params.get("focus");
    const found = res.data.find((r) => r._id === focus);
    setActive(found || res.data[0] || null);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (decision) => {
    if (!active) return;
    await api.patch(`/reviews/${active._id}`, { decision });
    push(decision === "verified" ? "Verified — alerts dispatched" : "Rejected");
    await load();
  };

  const doc = active?.circularId?.documentText || "";

  const grouped = useMemo(() => queue, [queue]);

  return (
    <>
      <Topbar title="Review queue" subtitle="Only grounded, high-confidence items should reach SME owners" />
      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-5">
        <div className="border-r border-black/5 lg:col-span-2">
          {grouped.length ? (
            grouped.map((item) => (
              <button
                key={item._id}
                onClick={() => setActive(item)}
                className={`block w-full border-b border-black/5 px-5 py-4 text-left ${
                  active?._id === item._id ? "bg-white" : "hover:bg-white/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{item.obligationType}</p>
                  <StatusBadge status={item.reviewStatus} />
                </div>
                <p className="mt-1 text-xs text-ink/45">{item.businessCategory}</p>
                <div className="mt-2">
                  <ConfidenceMeter value={item.confidence} />
                </div>
              </button>
            ))
          ) : (
            <div className="p-6">
              <EmptyState title="Queue clear" body="No pending or low-confidence obligations." />
            </div>
          )}
        </div>
        <div className="space-y-4 p-6 lg:col-span-3">
          {active ? (
            <>
              <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={active.groundingStatus} />
                  <StatusBadge status={active.reviewStatus} />
                </div>
                <h2 className="mt-2 font-display text-2xl">{active.obligationType}</h2>
                <p className="bn mt-3 leading-7">{active.summaryBangla}</p>
                <p className="mt-3 text-sm text-ink/55">Penalty: {active.penalty}</p>
                <div className="mt-5 flex gap-2">
                  <button onClick={() => decide("verified")} className="rounded-xl bg-forest-800 px-4 py-2 text-sm text-white">
                    Verify & match SMEs
                  </button>
                  <button onClick={() => decide("rejected")} className="rounded-xl border border-rose-200 px-4 py-2 text-sm text-rose-800">
                    Reject
                  </button>
                </div>
              </div>
              <SourceEvidence documentText={doc} spans={active.sourceSpans} />
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
