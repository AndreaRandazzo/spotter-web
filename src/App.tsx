import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useAuth } from "./auth/useAuth";
import ProtectedRoute from "./auth/ProtectedRoute";
import GuestRoute from "./auth/GuestRoute";
import AppLayout from "./layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import PlanPage from "./pages/PlanPage";
import SessionHistoryPage from "./pages/SessionHistoryPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import LoggingPage from "./pages/LoggingPage";

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950 text-stone-400">
        Caricamento…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/sessions" element={<SessionHistoryPage />} />
            <Route path="/sessions/:id" element={<SessionDetailPage />} />
            <Route path="/train/:dayId" element={<LoggingPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
