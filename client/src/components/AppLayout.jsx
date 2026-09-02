import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Sidebar from "./Sidebar.jsx";

export default function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="grid min-h-screen place-items-center text-ink/50">Loading ComplyBD…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-screen bg-[#f3f6f4]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
