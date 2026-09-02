import { useAuth } from "../context/AuthContext.jsx";

const roleLabel = {
  accountant: "Accountant",
  owner: "SME owner",
  reviewer: "Compliance reviewer",
};

export default function Topbar({ title, subtitle }) {
  const { user, logout } = useAuth();
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 bg-white/80 px-6 py-4 backdrop-blur">
      <div>
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-ink/55">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="bn text-sm font-semibold">{user?.name}</p>
          <p className="text-xs text-ink/45">{roleLabel[user?.role] || user?.role}</p>
        </div>
        <button
          onClick={logout}
          className="rounded-xl border border-black/10 px-3 py-2 text-sm text-ink/70 hover:bg-clay"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
