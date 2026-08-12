import { Navigate, Outlet } from "react-router";
import { useAuth } from "./useAuth";

export default function GuestRoute() {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : <Outlet />;
}
