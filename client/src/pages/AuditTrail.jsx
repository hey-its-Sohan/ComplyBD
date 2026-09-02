import { useEffect, useState } from "react";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function AuditTrail() {
  const { push } = useToast();
  const [logs, setLogs] = useState([]);
  const [anchors, setAnchors] = useState([]);

  const load = async () => {
    const [a, b] = await Promise.all([api.get("/audit"), api.get("/audit/anchors")]);
    setLogs(a.data);
    setAnchors(b.data);
  };

  useEffect(() => {
    load();
  }, []);

  const anchorNow = async () => {
    await api.post("/audit/anchor");
    push("Audit trail anchored (simulated chain)");
    load();
  };

  return (
    <>
      <Topbar title="Audit trail" subtitle="Append-only hash chain · periodic Merkle anchors" />
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Chain anchors</h2>
          <button onClick={anchorNow} className="rounded-xl bg-forest-800 px-4 py-2 text-sm text-white">
            Anchor now
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {anchors.map((a) => (
            <div key={a._id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-card">
              <p className="text-xs uppercase text-ink/40">{a.chain}</p>
              <p className="mt-1 break-all font-mono text-xs">{a.merkleRoot}</p>
              <p className="mt-2 text-xs text-ink/50">
                {a.entryCount} entries · tx {a.txHash?.slice(0, 18)}…
              </p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-clay/60 text-xs uppercase tracking-wider text-ink/50">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Hash</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-t border-black/5">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink/50">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {log.action}
                    <div className="text-xs text-ink/40">
                      {log.entityType} {log.entityId?.slice?.(0, 8)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{log.actorId?.name || "system"}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink/60">
                    <div>prev {log.previousHash?.slice(0, 14)}…</div>
                    <div>cur {log.currentHash?.slice(0, 14)}…</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
