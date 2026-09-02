export default function Toast({ message, tone }) {
  const cls =
    tone === "error"
      ? "bg-red-700 text-white"
      : tone === "warn"
        ? "bg-amber-700 text-white"
        : "bg-forest-800 text-white";
  return (
    <div className={`min-w-[240px] max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg ${cls}`}>
      {message}
    </div>
  );
}
