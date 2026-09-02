import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import AppLayout from "./components/AppLayout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import AccountantDashboard from "./pages/AccountantDashboard.jsx";
import OwnerDashboard from "./pages/OwnerDashboard.jsx";
import AlertDetails from "./pages/AlertDetails.jsx";
import ReviewQueue from "./pages/ReviewQueue.jsx";
import CircularsPage from "./pages/CircularsPage.jsx";
import AuditTrail from "./pages/AuditTrail.jsx";

function RoleHome() {
  const { user } = useAuth();
  if (user?.role === "owner") return <Navigate to="/owner" replace />;
  if (user?.role === "reviewer") return <Navigate to="/review" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<RoleHome />} />
        <Route path="/dashboard" element={<AccountantDashboard />} />
        <Route path="/owner" element={<OwnerDashboard />} />
        <Route path="/alerts/:id" element={<AlertDetails />} />
        <Route path="/review" element={<ReviewQueue />} />
        <Route path="/circulars" element={<CircularsPage />} />
        <Route path="/audit" element={<AuditTrail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
