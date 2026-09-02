export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <button className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="font-display text-xl text-ink">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-ink/50 hover:bg-slate-50">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
