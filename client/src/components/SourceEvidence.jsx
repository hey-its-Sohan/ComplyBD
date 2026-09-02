function highlight(text, spans) {
  if (!text) return null;
  if (!spans?.length) return <span>{text}</span>;
  const sorted = [...spans].filter((s) => typeof s.start === "number").sort((a, b) => a.start - b.start);
  const parts = [];
  let cursor = 0;
  sorted.forEach((span, i) => {
    const start = Math.max(0, span.start);
    const end = Math.min(text.length, span.end ?? start + (span.text?.length || 0));
    if (start > cursor) parts.push(<span key={`t-${i}`}>{text.slice(cursor, start)}</span>);
    parts.push(
      <mark key={`m-${i}`} className="rounded bg-amber-200/80 px-0.5 text-ink">
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return parts;
}

export default function SourceEvidence({ documentText, spans }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-clay/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">Source evidence</p>
        <p className="text-xs text-ink/45">{spans?.length || 0} grounded span(s)</p>
      </div>
      <pre className="bn whitespace-pre-wrap text-sm leading-7 text-ink/90">{highlight(documentText, spans)}</pre>
    </div>
  );
}
