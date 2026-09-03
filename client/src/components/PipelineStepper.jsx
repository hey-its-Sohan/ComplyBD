/**
 * The five pipeline stages, shown as a vertical run so the arrows between them
 * read as flow rather than decoration. Stages are numbered because this content
 * genuinely is a sequence — each stage consumes the previous one's output.
 */

const STATUS_STYLES = {
  idle: {
    dot: "border-black/10 bg-white text-ink/30",
    label: "text-ink/35",
    rail: "bg-black/5",
  },
  running: {
    dot: "border-forest-500 bg-forest-50 text-forest-700",
    label: "text-forest-800 font-semibold",
    rail: "bg-forest-200",
  },
  complete: {
    dot: "border-forest-600 bg-forest-600 text-white",
    label: "text-ink font-semibold",
    rail: "bg-forest-300",
  },
  warning: {
    dot: "border-amber-500 bg-amber-500 text-white",
    label: "text-amber-900 font-semibold",
    rail: "bg-amber-200",
  },
};

function Glyph({ status, index }) {
  if (status === "complete") return <span aria-hidden="true">✓</span>;
  if (status === "warning") return <span aria-hidden="true">!</span>;
  if (status === "running") {
    return (
      <span className="h-2 w-2 animate-pulse rounded-full bg-forest-600" aria-hidden="true" />
    );
  }
  return <span className="text-xs tabular-nums">{index + 1}</span>;
}

export default function PipelineStepper({ steps = [], trace = [], running = false }) {
  const byKey = Object.fromEntries(trace.map((t) => [t.key, t]));
  const nextIndex = steps.findIndex((s) => !byKey[s.key]);

  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const entry = byKey[step.key];
        const isRunning = running && i === nextIndex;
        const status = entry ? entry.status : isRunning ? "running" : "idle";
        const style = STATUS_STYLES[status] || STATUS_STYLES.idle;
        const last = i === steps.length - 1;

        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm transition-colors ${style.dot}`}
              >
                <Glyph status={status} index={i} />
              </div>
              {!last ? <div className={`w-px flex-1 ${style.rail}`} /> : null}
            </div>

            <div className={`min-w-0 flex-1 ${last ? "pb-0" : "pb-5"}`}>
              <p className={`text-sm leading-7 ${style.label}`}>{step.label}</p>
              {entry?.detail ? (
                <p className="mt-0.5 break-words text-xs leading-5 text-ink/50">{entry.detail}</p>
              ) : null}
              {entry && typeof entry.ms === "number" && entry.ms > 0 ? (
                <p className="mt-0.5 text-[11px] tabular-nums text-ink/30">{entry.ms} ms</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
