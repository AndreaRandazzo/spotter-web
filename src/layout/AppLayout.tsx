import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/useAuth";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-white"
    : "text-stone-400 hover:text-stone-200 transition-colors";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const isTrainer = user!.roles.includes("ROLE_TRAINER");

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <nav className="border-b border-stone-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="text-lg font-bold tracking-tight">
              Spotter
            </NavLink>
            <div className="flex items-center gap-4 text-sm">
              {isTrainer ? (
                <NavLink to="/" end className={navLinkClass}>
                  Atleti
                </NavLink>
              ) : (
                <>
                  <NavLink to="/" end className={navLinkClass}>
                    Home
                  </NavLink>
                  <NavLink to="/plan" className={navLinkClass}>
                    Piano
                  </NavLink>
                  <NavLink to="/sessions" className={navLinkClass}>
                    Sessioni
                  </NavLink>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-400">{user!.firstName}</span>
            <button
              onClick={logout}
              className="text-sm text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
            >
              Esci
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
