import { useState, useEffect } from "react";
import { Link } from "react-router";
import { listSessions } from "../api/sessions";
import type { WorkoutSessionSummary } from "../types/sessions";
import LoadingScreen from "../ui/LoadingScreen";

export default function SessionHistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const page = await listSessions();
        setSessions(page.content);
      } catch {
        setError("Errore nel caricamento delle sessioni.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <p className="text-red-400 py-10">{error}</p>;

  if (sessions.length === 0) {
    return (
      <p className="text-stone-500 py-10">Nessuna sessione registrata.</p>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Le tue sessioni</h1>
      <div className="space-y-2">
        {sessions.map((s) => (
          <Link
            key={s.id}
            to={`/sessions/${s.id}`}
            className="flex items-center justify-between rounded-lg border border-stone-800 px-4 py-3 hover:border-stone-600 transition-colors"
          >
            <div>
              <p className="text-sm font-medium">{s.planDayName}</p>
              <p className="text-xs text-stone-400">
                {new Date(s.startedAt).toLocaleDateString("it-IT", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                s.status === "COMPLETED"
                  ? "bg-green-900/50 text-green-400"
                  : "bg-amber-900/50 text-amber-400"
              }`}
            >
              {s.status === "COMPLETED" ? "Completata" : "In corso"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
