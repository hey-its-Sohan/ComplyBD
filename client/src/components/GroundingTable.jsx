/**
 * Field | AI Output | Source Evidence | Grounded | Confidence
 *
 * The row is the argument: an AI value sitting next to the exact words from the
 * circular that justify it. Rows that could not be justified are marked in red
 * rather than quietly dropped, because the absence is the finding.
 *
 * Selecting a row drives the highlight in the source viewer beside it.
 */
export default function GroundingTable({ rows = [], activeField, onSelect }) {
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-card">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-black/5 bg-clay/50 text-xs text-forest-800">
            <th className="px-4 py-3 font-semibold">Field</th>
            <th className="px-4 py-3 font-semibold">AI output</th>
            <th className="px-4 py-3 font-semibold">Source evidence</th>
            <th className="px-4 py-3 text-center font-semibold">Grounded</th>
            <th className="px-4 py-3 text-right font-semibold">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = activeField === row.field;
            return (
              <tr
                key={row.field}
                onClick={() => onSelect && onSelect(row.field)}
                className={`cursor-pointer border-b border-black/5 align-top last:border-b-0 transition-colors ${
                  active ? "bg-forest-50" : row.grounded ? "hover:bg-clay/40" : "bg-rose-50/60 hover:bg-rose-50"
                }`}
              >
                <td className="px-4 py-3">
                  <span className={`font-semibold ${active ? "text-forest-900" : "text-ink"}`}>
                    {row.label}
                  </span>
                  {row.matchType && row.grounded ? (
                    <span className="mt-0.5 block text-[11px] text-ink/40">
                      {row.matchType === "exact"
                        ? "exact match"
                        : row.matchType === "variant"
                          ? "equivalent form"
                          : "phrase overlap"}
                    </span>
                  ) : null}
                </td>

                <td className="px-4 py-3">
                  <span className={`bn ${row.grounded ? "text-ink/85" : "text-rose-900"}`}>
                    {row.aiOutput}
                  </span>
                </td>

                <td className="max-w-sm px-4 py-3">
                  {row.grounded ? (
                    <>
                      <span className="bn rounded bg-amber-200/70 px-1 py-0.5 leading-7 text-ink">
                        {row.evidence}
                      </span>
                      {typeof row.start === "number" ? (
                        <span className="mt-1 block text-[11px] tabular-nums text-ink/35">
                          characters {row.start}–{row.end}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="font-semibold text-rose-800">
                      Not found in source — requires review
                    </span>
                  )}
                  {row.evidenceClaimVerified === false ? (
                    <span className="mt-1 block text-[11px] text-rose-700">
                      The quote the model cited is not in this document.
                    </span>
                  ) : null}
                </td>

                <td className="px-4 py-3 text-center">
                  {row.grounded ? (
                    <span className="text-lg leading-none text-emerald-600" title="Grounded">
                      ✓
                    </span>
                  ) : (
                    <span className="text-lg leading-none text-rose-600" title="Not grounded">
                      ✕
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-right">
                  <span
                    className={`tabular-nums font-semibold ${
                      row.confidence >= 80
                        ? "text-emerald-700"
                        : row.confidence >= 55
                          ? "text-amber-700"
                          : "text-rose-700"
                    }`}
                  >
                    {row.confidence}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
