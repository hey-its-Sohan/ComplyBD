import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const items = [
  { to: "/dashboard", label: "Accountant", roles: ["accountant"] },
  { to: "/owner", label: "My business", roles: ["owner"] },
  { to: "/review", label: "Review queue", roles: ["accountant", "reviewer"] },
  { to: "/circulars", label: "Circulars", roles: ["accountant", "reviewer", "owner"] },
  { to: "/audit", label: "Audit trail", roles: ["accountant", "reviewer"] },
];

export default function Sidebar() {
  const { user } = useAuth();
  const role = user?.role;
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-black/5 bg-forest-900 text-white">
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
      <nav className="flex-1 space-y-1 px-3">
        {items
          .filter((i) => i.roles.includes(role))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
  );
}
