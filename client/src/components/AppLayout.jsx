import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Sidebar from "./Sidebar.jsx";
import Disclaimer from "./Disclaimer.jsx";

export default function AppLayout() {
  const { user, loading } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-ink/50">Loading ComplyBD…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-[#f3f6f4]">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Only rendered below lg, where the sidebar is a drawer. */}
        <div className="flex items-center gap-3 border-b border-black/5 bg-white/80 px-4 py-3 lg:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm text-ink/70"
          >
            ☰
          </button>
          <span className="font-display text-lg text-ink">ComplyBD</span>
        </div>

        <div key={location.pathname} className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>

        <Disclaimer variant="bar" />
      </div>
    </div>
  );
}
