const map = {
  verified: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  grounded: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  authorized: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  new: "bg-sky-50 text-sky-800 ring-sky-200",
  seen: "bg-slate-100 text-slate-700 ring-slate-200",
  acknowledged: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  resolved: "bg-forest-50 text-forest-800 ring-forest-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  needs_review: "bg-orange-50 text-orange-800 ring-orange-200",
  partial: "bg-amber-50 text-amber-800 ring-amber-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200",
  ungrounded: "bg-rose-50 text-rose-800 ring-rose-200",
  high: "bg-rose-50 text-rose-800 ring-rose-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  low: "bg-slate-100 text-slate-700 ring-slate-200",
  ingested: "bg-slate-100 text-slate-700 ring-slate-200",
  extracted: "bg-forest-50 text-forest-800 ring-forest-200",
};

const labels = {
  verified: "Verified",
  grounded: "Grounded",
  authorized: "Authorized",
  new: "New",
  seen: "Seen",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  pending: "Pending",
  needs_review: "Needs review",
  partial: "Partial",
  rejected: "Rejected",
  ungrounded: "Ungrounded",
  high: "High",
  medium: "Medium",
  low: "Low",
  ingested: "Ingested",
  extracted: "Extracted",
};

export default function StatusBadge({ status }) {
  if (!status) return null;
  const key = String(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${map[key] || "bg-slate-100 text-slate-700 ring-slate-200"}`}>
      {labels[key] || key}
    </span>
  );
}
