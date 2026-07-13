import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth";

export function GuestRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
