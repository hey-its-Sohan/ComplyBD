export default function StatCard({ label, value, hint, accent = "forest" }) {
  const ring = accent === "brass" ? "from-brass-400/30" : accent === "rose" ? "from-rose-300/40" : "from-forest-200/80";
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-black/5 bg-white p-5 shadow-card`}>
      <div className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${ring} to-transparent`} />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest-700/70">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
      {hint ? <p className="mt-1 text-sm text-ink/55">{hint}</p> : null}
    </div>
  );
}
