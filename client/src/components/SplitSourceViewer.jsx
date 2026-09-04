import { useEffect, useMemo, useRef } from "react";

/**
 * The demonstration of the whole idea: the obligation on the left, the original
 * circular on the right, and a visible line between each claim and the words
 * that support it.
 *
 * Highlights are built from character offsets returned by the grounding engine,
 * not from re-searching the text in the browser. If the offsets were wrong the
 * highlight would land on the wrong words, so this view is also a live check on
 * the backend.
 */

const FIELD_LABELS = {
  businessCategory: "Affected category",
  obligationType: "Obligation type",
  effectiveDate: "Effective date",
  penalty: "Penalty",
};

/** Split the document into plain and highlighted runs, ordered and non-overlapping. */
function buildSegments(text, spans) {
  const valid = (spans || [])
    .filter((s) => typeof s.start === "number" && typeof s.end === "number" && s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;

  valid.forEach((span) => {
    const start = Math.max(cursor, Math.min(span.start, text.length));
    const end = Math.max(start, Math.min(span.end, text.length));
    if (start >= end) return;
    if (start > cursor) segments.push({ type: "text", text: text.slice(cursor, start) });
    segments.push({ type: "mark", text: text.slice(start, end), field: span.field, start, end });
    cursor = end;
  });

  if (cursor < text.length) segments.push({ type: "text", text: text.slice(cursor) });
  return segments;
}

function ObligationField({ label, value, grounded, active, onClick, bangla }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
        active
          ? "border-forest-400 bg-forest-50"
          : grounded
            ? "border-black/5 bg-white hover:border-forest-200"
            : "border-rose-200 bg-rose-50/70 hover:border-rose-300"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-ink/45">{label}</span>
        <span className={grounded ? "text-xs text-emerald-700" : "text-xs font-semibold text-rose-700"}>
          {grounded ? "grounded" : "not grounded"}
        </span>
      </div>
      <p className={`${bangla ? "bn " : ""}mt-1 text-sm leading-6 ${grounded ? "text-ink" : "text-rose-900"}`}>
        {value}
      </p>
      {!grounded ? (
        <p className="mt-1 text-[11px] text-rose-700">Not found in source — requires review</p>
      ) : null}
    </button>
  );
}

export default function SplitSourceViewer({
  documentText = "",
  rows = [],
  activeField,
  onSelectField,
  summaryBangla,
  requiredAction,
}) {
  const sourceRef = useRef(null);
  const activeRef = useRef(null);

  const spans = useMemo(
    () =>
      rows
        .filter((r) => r.grounded && typeof r.start === "number")
        .map((r) => ({ field: r.field, start: r.start, end: r.end })),
    [rows]
  );

  const segments = useMemo(() => buildSegments(documentText, spans), [documentText, spans]);

  // Scroll the selected evidence into view inside the source pane only, so
  // choosing a field does not move the whole page under the reader.
  useEffect(() => {
    if (!activeField || !activeRef.current || !sourceRef.current) return;
    const pane = sourceRef.current;
    const mark = activeRef.current;
    const offset = mark.offsetTop - pane.offsetTop - pane.clientHeight / 3;
    pane.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
  }, [activeField]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* LEFT — what the pipeline concluded */}
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-card">
        <h3 className="font-display text-lg text-ink">Extracted obligation</h3>
        <p className="mt-0.5 text-xs text-ink/45">
          Select a field to find its evidence in the circular.
        </p>

        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <ObligationField
              key={row.field}
              label={FIELD_LABELS[row.field] || row.label}
              value={row.aiOutput}
              grounded={row.grounded}
              active={activeField === row.field}
              bangla={row.field === "penalty"}
              onClick={() => onSelectField && onSelectField(row.field)}
            />
          ))}
        </div>

        {requiredAction ? (
          <div className="mt-4 rounded-xl border border-black/5 bg-clay/40 px-3 py-2.5">
            <p className="text-xs text-ink/45">What the business must do</p>
            <p className="bn mt-1 text-sm leading-7 text-ink/90">{requiredAction}</p>
          </div>
        ) : null}

        {summaryBangla ? (
          <div className="mt-2 rounded-xl border border-black/5 bg-clay/40 px-3 py-2.5">
            <p className="text-xs text-ink/45">Plain-Bangla summary</p>
            <p className="bn mt-1 text-sm leading-7 text-ink/90">{summaryBangla}</p>
          </div>
        ) : null}
      </div>

      {/* RIGHT — the document itself */}
      <div className="flex min-h-0 flex-col rounded-2xl border border-black/5 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
          <h3 className="font-display text-lg text-ink">Original circular</h3>
          <span className="text-xs text-ink/45">
            {spans.length} highlighted {spans.length === 1 ? "span" : "spans"}
          </span>
        </div>

        <div ref={sourceRef} className="relative max-h-[32rem] overflow-y-auto px-5 py-4">
          <pre className="bn whitespace-pre-wrap break-words font-sans text-sm leading-8 text-ink/85">
            {segments.map((seg, i) =>
              seg.type === "mark" ? (
                <mark
                  key={i}
                  ref={seg.field === activeField ? activeRef : null}
                  onClick={() => onSelectField && onSelectField(seg.field)}
                  className={`cursor-pointer rounded px-0.5 transition-colors ${
                    seg.field === activeField
                      ? "bg-forest-300 text-ink ring-2 ring-forest-500"
                      : "bg-amber-200/70 text-ink hover:bg-amber-300/70"
                  }`}
                  title={FIELD_LABELS[seg.field] || seg.field}
                >
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </pre>
        </div>

        <div className="border-t border-black/5 px-5 py-2.5 text-[11px] leading-5 text-ink/40">
          Highlights are drawn from character offsets recorded during grounding, so each one points
          at the exact words that justified a field.
        </div>
      </div>
    </div>
  );
}
