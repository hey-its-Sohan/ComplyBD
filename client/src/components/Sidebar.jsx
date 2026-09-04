import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const items = [
  { to: "/accountant", label: "Dashboard", roles: ["accountant"], end: true },
  { to: "/accountant/clients", label: "Clients", roles: ["accountant"] },
  { to: "/accountant/alerts", label: "Alert center", roles: ["accountant"] },
  { to: "/owner", label: "আমার ব্যবসা", roles: ["owner"] },
  { to: "/intelligence", label: "Regulatory intelligence", roles: ["accountant", "reviewer"] },
  { to: "/review", label: "Review queue", roles: ["accountant", "reviewer"] },
  { to: "/circulars", label: "Circulars", roles: ["accountant", "reviewer"] },
  { to: "/how-it-works", label: "How it works", roles: ["accountant", "reviewer", "owner"] },
  { to: "/audit", label: "Audit trail", roles: ["accountant", "reviewer"] },
  { to: "/blockchain", label: "Blockchain anchors", roles: ["accountant", "reviewer"] },
];

/**
 * Static rail from `lg` up, slide-in drawer below it. The drawer is rendered in
 * both cases rather than duplicated, so a nav item only ever exists once.
 */
export default function Sidebar({ open = false, onClose }) {
  const { user } = useAuth();
  const role = user?.role;

  return (
    <>
      {open ? (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-black/5 bg-forest-900 text-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 pb-6 pt-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brass-400 font-display text-lg text-forest-900">
              চ
            </div>
            <div>
              <p className="font-display text-lg leading-none">ComplyBD</p>
              <p className="bn mt-1 text-[11px] text-white/60">নিয়ম → স্পষ্ট ভাষা</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {items
            .filter((i) => i.roles.includes(role))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-2.5 text-sm ${
                    isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="p-4 text-[11px] leading-relaxed text-white/40">
          Grounded extraction · human review · hashed audit chain
        </div>
      </aside>
    </>
  );
}
