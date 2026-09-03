import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Route-level role check.
 *
 * The server is the real boundary — every endpoint scopes or rejects by role
 * regardless of what the browser does. This exists so a person who lands on a
 * URL they cannot use gets sent somewhere useful instead of an empty screen and
 * a string of 403s.
 *
 * Redirects rather than showing "access denied": if you are an owner, the owner
 * dashboard is where you wanted to be anyway.
 */
export function homeFor(role) {
  if (role === "owner") return "/owner";
  if (role === "reviewer") return "/review";
  return "/accountant";
}

export default function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return children;
}
