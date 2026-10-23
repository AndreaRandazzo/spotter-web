import { useState, useEffect } from "react";
import { Link } from "react-router";
import { AxiosError } from "axios";
import { getMyPlan } from "../api/plans";
import type { WorkoutPlan } from "../types/plans";
import LoadingScreen from "../ui/LoadingScreen";

export default function PlanPage() {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setPlan(await getMyPlan());
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 404) {
          setNotFound(true);
        } else {
          setError("Errore nel caricamento del piano.");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <p className="text-red-400 py-10">{error}</p>;
  if (notFound) {
    return (
      <p className="text-stone-500 py-10">
        Nessun piano attivo — chiedi al tuo trainer di crearne uno.
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">{plan!.name}</h1>
      {plan!.description && (
        <p className="text-stone-400 text-sm mb-6">{plan!.description}</p>
      )}

      <div className="space-y-6 mt-6">
        {plan!.days
          .toSorted((a, b) => a.orderIndex - b.orderIndex)
          .map((day) => (
            <section key={day.id}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{day.name}</h2>
                <Link
                  to={`/train/${day.id}`}
                  className="rounded-md bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-950 hover:bg-white transition-colors"
                >
                  Inizia allenamento
                </Link>
              </div>

              <div className="rounded-lg border border-stone-800 divide-y divide-stone-800">
                {day.exercises
                  .toSorted((a, b) => a.orderIndex - b.orderIndex)
                  .map((ex) => (
                    <div key={ex.id} className="px-4 py-3">
                      <p className="text-sm font-medium">{ex.exerciseName}</p>
                      <p className="text-xs text-stone-400 mt-1">
                        {ex.targetSets} &times; {ex.targetReps}
                        {ex.targetRpe != null && ` @ RPE ${ex.targetRpe}`}
                        {ex.restSeconds != null &&
                          ` · ${ex.restSeconds}s rec.`}
                      </p>
                      {ex.notes && (
                        <p className="text-xs text-stone-500 mt-1">
                          {ex.notes}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
