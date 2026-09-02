import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge.jsx";
import ConfidenceMeter from "./ConfidenceMeter.jsx";

export default function ObligationTable({ rows }) {
  if (!rows?.length) {
    return <p className="text-sm text-ink/50">No obligations yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-card">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-clay/60 text-xs uppercase tracking-wider text-ink/50">
          <tr>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Summary</th>
            <th className="px-4 py-3">Grounding</th>
            <th className="px-4 py-3">Review</th>
            <th className="px-4 py-3">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id} className="border-t border-black/5 align-top">
              <td className="px-4 py-3 font-medium">
                <Link to={`/review?focus=${row._id}`} className="hover:text-forest-700">
                  {row.obligationType}
                </Link>
                <div className="text-xs text-ink/40">{row.circularId?.title?.slice(0, 42) || ""}</div>
              </td>
              <td className="px-4 py-3">{row.businessCategory}</td>
              <td className="bn px-4 py-3 max-w-xs text-ink/80">{row.summaryBangla}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.groundingStatus} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.reviewStatus} />
              </td>
              <td className="px-4 py-3">
                <ConfidenceMeter value={row.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
