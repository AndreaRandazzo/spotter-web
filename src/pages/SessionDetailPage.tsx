import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { getSession } from "../api/sessions";
import type { WorkoutSession } from "../types/sessions";
import LoadingScreen from "../ui/LoadingScreen";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setSession(await getSession(id!));
      } catch {
        setError("Errore nel caricamento della sessione.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <LoadingScreen />;
  if (error) return <p className="text-red-400 py-10">{error}</p>;

  const s = session!;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{s.planDayName}</h1>
        <p className="text-sm text-stone-400 mt-1">
          {new Date(s.startedAt).toLocaleDateString("it-IT", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {s.completedAt && (
            <>
              {" — completata alle "}
              {new Date(s.completedAt).toLocaleTimeString("it-IT", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </>
          )}
        </p>
        <span
          className={`inline-block text-xs px-2 py-0.5 rounded-full mt-2 ${
            s.status === "COMPLETED"
              ? "bg-green-900/50 text-green-400"
              : "bg-amber-900/50 text-amber-400"
          }`}
        >
          {s.status === "COMPLETED" ? "Completata" : "In corso"}
        </span>
      </div>

      <div className="space-y-6">
        {s.exerciseLogs
          .toSorted((a, b) => a.orderIndex - b.orderIndex)
          .map((log) => (
            <section key={log.id}>
              <h2 className="text-lg font-semibold mb-2">
                {log.exerciseName}
              </h2>
              {log.sets.length > 0 ? (
                <div className="rounded-lg border border-stone-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-800 text-stone-400 text-xs">
                        <th className="text-left px-4 py-2 font-medium">
                          Set
                        </th>
                        <th className="text-left px-4 py-2 font-medium">
                          Reps
                        </th>
                        <th className="text-left px-4 py-2 font-medium">
                          Peso
                        </th>
                        <th className="text-left px-4 py-2 font-medium">
                          RPE
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800">
                      {log.sets
                        .toSorted((a, b) => a.setNumber - b.setNumber)
                        .map((set) => (
                          <tr key={set.setNumber}>
                            <td className="px-4 py-2">
                              {set.isWarmup ? "W" : set.setNumber}
                            </td>
                            <td className="px-4 py-2">{set.reps}</td>
                            <td className="px-4 py-2">
                              {set.weight != null ? `${set.weight} kg` : "—"}
                            </td>
                            <td className="px-4 py-2">
                              {set.rpe != null ? set.rpe : "—"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  Nessuna serie registrata.
                </p>
              )}
            </section>
          ))}
      </div>
    </div>
  );
}
