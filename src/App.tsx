import { useAuth } from "./auth/useAuth";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950 text-stone-400">
        Caricamento…
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-8">
      <h1 className="text-2xl font-bold mb-4">Ciao {user.firstName}</h1>
      <pre className="text-sm text-stone-400 mb-6">
        {JSON.stringify(user, null, 2)}
      </pre>
      <button
        onClick={logout}
        className="rounded-md border border-stone-700 px-4 py-2 text-sm hover:bg-stone-900"
      >
        Esci
      </button>
    </div>
  );
}
