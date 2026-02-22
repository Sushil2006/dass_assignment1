import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/authState";
import type { AuthUser } from "../lib/auth";

type Props = { roles?: AuthUser["role"][] };

function pathForRole(role: AuthUser["role"]): string {
  if (role === "participant") return "/participant";
  if (role === "organizer") return "/organizer";
  return "/admin";
}

export default function ProtectedRoute({ roles }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-3">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to={pathForRole(user.role)} replace />;

  return <Outlet />;
}
