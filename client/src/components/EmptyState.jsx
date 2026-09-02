export default function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-forest-200 bg-white/60 px-6 py-12 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      {body ? <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
