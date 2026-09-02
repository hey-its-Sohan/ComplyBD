export default function ConfidenceMeter({ value = 0 }) {
  const n = Math.max(0, Math.min(100, Number(value) || 0));
  const color = n >= 80 ? "bg-emerald-600" : n >= 55 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="min-w-[120px]">
      <div className="mb-1 flex justify-between text-[11px] font-semibold text-ink/60">
        <span>Confidence</span>
        <span>{n}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${n}%` }} />
      </div>
    </div>
  );
}
