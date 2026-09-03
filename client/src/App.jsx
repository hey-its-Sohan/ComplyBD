import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import AppLayout from "./components/AppLayout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import AccountantDashboard from "./pages/AccountantDashboard.jsx";
import OwnerDashboard from "./pages/OwnerDashboard.jsx";
import AlertDetails from "./pages/AlertDetails.jsx";
import ReviewQueue from "./pages/ReviewQueue.jsx";
import CircularsPage from "./pages/CircularsPage.jsx";
import RegulatoryIntelligence from "./pages/RegulatoryIntelligence.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import ClientDetail from "./pages/ClientDetail.jsx";
import AlertCenter from "./pages/AlertCenter.jsx";
import ObligationDetail from "./pages/ObligationDetail.jsx";
import BlockchainPage from "./pages/BlockchainPage.jsx";
import RequireRole, { homeFor } from "./components/RequireRole.jsx";
import HowItWorks from "./pages/HowItWorks.jsx";
import AuditTrail from "./pages/AuditTrail.jsx";

/** Sends each role to its own landing page. Shares homeFor with RequireRole
    so a redirect and a guard can never disagree about where someone belongs. */
function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={homeFor(user?.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<RoleHome />} />

        {/* Open to every role — it is the product explanation. */}
        <Route path="/how-it-works" element={<HowItWorks />} />

        {/* Accountant desk. The server scopes every response by role as well;
            these guards just send people somewhere they can actually use. */}
        <Route
          path="/accountant"
          element={
            <RequireRole roles={["accountant"]}>
              <AccountantDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/accountant/clients"
          element={
            <RequireRole roles={["accountant"]}>
              <ClientsPage />
            </RequireRole>
          }
        />
        <Route
          path="/accountant/clients/:id"
          element={
            <RequireRole roles={["accountant", "reviewer"]}>
              <ClientDetail />
            </RequireRole>
          }
        />
        <Route
          path="/accountant/alerts"
          element={
            <RequireRole roles={["accountant"]}>
              <AlertCenter />
            </RequireRole>
          }
        />

        {/* Kept so links and bookmarks from the first build keep working. */}
        <Route path="/dashboard" element={<Navigate to="/accountant" replace />} />

        <Route
          path="/owner"
          element={
            <RequireRole roles={["owner"]}>
              <OwnerDashboard />
            </RequireRole>
          }
        />

        {/* An owner may open their own alert; the API refuses anyone else's. */}
        <Route path="/alerts/:id" element={<AlertDetails />} />

        <Route
          path="/obligations/:id"
          element={
            <RequireRole roles={["accountant", "reviewer"]}>
              <ObligationDetail />
            </RequireRole>
          }
        />
        <Route
          path="/review"
          element={
            <RequireRole roles={["accountant", "reviewer"]}>
              <ReviewQueue />
            </RequireRole>
          }
        />
        <Route
          path="/circulars"
          element={
            <RequireRole roles={["accountant", "reviewer", "owner"]}>
              <CircularsPage />
            </RequireRole>
          }
        />
        <Route
          path="/intelligence"
          element={
            <RequireRole roles={["accountant", "reviewer"]}>
              <RegulatoryIntelligence />
            </RequireRole>
          }
        />

        {/* Audit metadata spans every client, so it is staff-only. */}
        <Route
          path="/audit"
          element={
            <RequireRole roles={["accountant", "reviewer"]}>
              <AuditTrail />
            </RequireRole>
          }
        />
        <Route
          path="/blockchain"
          element={
            <RequireRole roles={["accountant", "reviewer"]}>
              <BlockchainPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
