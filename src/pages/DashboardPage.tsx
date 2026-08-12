import { useAuth } from "../auth/useAuth";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-8">
      <h1 className="text-2xl font-bold mb-4">Ciao {user!.firstName}</h1>
      <pre className="text-sm text-stone-400 mb-6">
        {JSON.stringify(user, null, 2)}
      </pre>
      <button
        onClick={logout}
        className="rounded-md border border-stone-700 px-4 py-2 text-sm hover:bg-stone-900 cursor-pointer"
      >
        Esci
      </button>
    </div>
  );
}
