import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Topbar from "../components/Topbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Modal from "../components/Modal.jsx";
import ObligationTable from "../components/ObligationTable.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function CircularsPage() {
  const { push } = useToast();
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    title: "",
    source: "NBR",
    documentText: "",
    publishedDate: "",
    effectiveDate: "",
    sourceUrl: "",
  });

  const load = () => api.get("/circulars").then((res) => setList(res.data));

  useEffect(() => {
    load();
  }, []);

  const ingest = async (e) => {
    e.preventDefault();
    const res = await api.post("/circulars", form);
    push("Circular ingested");
    setOpen(false);
    await load();
    const extracted = await api.post(`/circulars/${res.data._id}/extract`);
    push(`Extracted ${extracted.data.obligations.length} obligation(s)`);
    await load();
  };

  const openDetail = async (id) => {
    const res = await api.get(`/circulars/${id}`);
    setSelected(res.data);
  };

  const canIngest = user?.role === "accountant" || user?.role === "reviewer";

  return (
    <>
      <Topbar title="Circulars" subtitle="NBR / VAT / SRO source documents" />
      <div className="p-6">
        <div className="mb-4 flex justify-end">
          {canIngest ? (
            <button onClick={() => setOpen(true)} className="rounded-xl bg-forest-800 px-4 py-2 text-sm text-white">
              Ingest circular
            </button>
          ) : null}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((c) => (
            <button
              key={c._id}
              onClick={() => openDetail(c._id)}
              className="rounded-2xl border border-black/5 bg-white p-5 text-left shadow-card hover:border-forest-200"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="bn font-semibold leading-snug">{c.title}</p>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-2 text-xs text-ink/45">
                {c.source} · published {c.publishedDate ? new Date(c.publishedDate).toLocaleDateString() : "—"}
              </p>
            </button>
          ))}
        </div>
        {!list.length ? <EmptyState title="No circulars" /> : null}

        {selected ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-card">
              <p className="text-xs uppercase tracking-wider text-ink/40">Selected document</p>
              <h2 className="bn mt-1 font-display text-2xl">{selected.circular.title}</h2>
              <pre className="bn mt-4 max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-7 text-ink/80">
                {selected.circular.documentText}
              </pre>
            </div>
            <ObligationTable rows={selected.obligations} />
            <Link to="/review" className="inline-block text-sm text-forest-700 underline">
              Open review queue
            </Link>
          </div>
        ) : null}
      </div>
      <Modal open={open} title="Ingest NBR circular" onClose={() => setOpen(false)}>
        <form onSubmit={ingest} className="space-y-3">
          <input
            required
            placeholder="Title"
            className="w-full rounded-xl border border-black/10 px-3 py-2"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            required
            rows={7}
            placeholder="Full Bangla / English circular text"
            className="bn w-full rounded-xl border border-black/10 px-3 py-2"
            value={form.documentText}
            onChange={(e) => setForm({ ...form, documentText: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="rounded-xl border border-black/10 px-3 py-2"
              value={form.publishedDate}
              onChange={(e) => setForm({ ...form, publishedDate: e.target.value })}
            />
            <input
              type="date"
              className="rounded-xl border border-black/10 px-3 py-2"
              value={form.effectiveDate}
              onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
            />
          </div>
          <button className="w-full rounded-xl bg-forest-800 py-2.5 text-sm text-white">Ingest & extract</button>
        </form>
      </Modal>
    </>
  );
}
