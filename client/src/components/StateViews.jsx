/**
 * Shared loading and error states.
 *
 * Errors say what failed and offer the way out, rather than apologising. An
 * empty screen is handled by EmptyState, which invites an action instead.
 */

export function LoadingBlock({ label = "Loading…", rows = 3 }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-black/5 bg-white p-5 shadow-card">
          <div className="h-3 w-1/3 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-black/5 bg-white p-5 shadow-card">
          <div className="h-2.5 w-20 rounded bg-slate-200" />
          <div className="mt-3 h-7 w-12 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-8 text-center">
      <p className="font-display text-lg text-rose-900">That didn’t load</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-rose-800/80">
        {message || "The server did not respond. Check that the API is running on port 5000."}
      </p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export default { LoadingBlock, ErrorBlock, StatSkeleton };
