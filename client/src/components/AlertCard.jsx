import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge.jsx";

export default function AlertCard({ alert }) {
  const business = alert.businessId?.name || "Business";
  return (
    <Link
      to={`/alerts/${alert._id}`}
      className="block rounded-2xl border border-black/5 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-forest-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{alert.title}</p>
          <p className="mt-1 text-xs text-ink/50">{business}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={alert.priority} />
          <StatusBadge status={alert.status} />
        </div>
      </div>
      <p className="bn mt-3 text-sm leading-relaxed text-ink/80">{alert.messageBangla}</p>
    </Link>
  );
}
