import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import ConfidenceMeter from "../components/ConfidenceMeter.jsx";
import SourceEvidence from "../components/SourceEvidence.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function AlertDetails() {
  const { id } = useParams();
  const { push } = useToast();
  const [alert, setAlert] = useState(null);

  const load = () => api.get(`/alerts/${id}`).then((res) => setAlert(res.data));

  useEffect(() => {
    load();
  }, [id]);

  const setStatus = async (status) => {
    const res = await api.patch(`/alerts/${id}`, { status });
    setAlert(res.data);
    push("Alert updated");
  };

  if (!alert) {
    return (
      <>
        <Topbar title="Alert" />
        <div className="p-6">Loading…</div>
      </>
    );
  }

  const ob = alert.obligationId || {};
  const circular = ob.circularId || {};
  const business = alert.businessId || {};

  return (
    <>
      <Topbar title="Alert details" subtitle={business.name} />
      <div className="grid gap-6 p-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-card">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={alert.priority} />
              <StatusBadge status={alert.status} />
              <StatusBadge status={ob.reviewStatus} />
            </div>
            <h2 className="mt-3 font-display text-2xl">{alert.title}</h2>
            <p className="bn mt-3 text-lg leading-relaxed text-ink/80">{alert.messageBangla}</p>
            <p className="bn mt-4 rounded-xl bg-clay/70 p-4 text-sm leading-7">{ob.summaryBangla}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["seen", "acknowledged", "resolved"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className="rounded-xl border border-black/10 px-3 py-1.5 text-sm capitalize hover:bg-clay"
                >
                  Mark {s}
                </button>
              ))}
            </div>
          </div>
          <SourceEvidence documentText={circular.documentText} spans={ob.sourceSpans} />
        </div>
        <aside className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
            <p className="text-xs uppercase tracking-wider text-ink/40">Obligation</p>
            <p className="mt-1 font-medium">{ob.obligationType}</p>
            <p className="mt-2 text-sm text-ink/55">{ob.businessCategory}</p>
            <p className="mt-2 text-sm">Penalty: {ob.penalty}</p>
            <div className="mt-4">
              <ConfidenceMeter value={ob.confidence} />
            </div>
            <p className="mt-4 text-xs text-ink/40">Effective {ob.effectiveDate ? new Date(ob.effectiveDate).toLocaleDateString() : "—"}</p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
            <p className="text-xs uppercase tracking-wider text-ink/40">Circular</p>
            <p className="mt-1 font-medium leading-snug">{circular.title}</p>
            <p className="mt-2 text-sm text-ink/50">{circular.source}</p>
            {circular.sourceUrl ? (
              <a className="mt-2 inline-block text-sm text-forest-700 underline" href={circular.sourceUrl} target="_blank" rel="noreferrer">
                Source URL
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}
