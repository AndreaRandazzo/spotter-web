import { useState, useEffect } from "react";
import { Link } from "react-router";
import { AxiosError } from "axios";
import { useAuth } from "../auth/useAuth";
import { listCoaching, acceptInvite, endRelationship } from "../api/coaching";
import { getMyPlan } from "../api/plans";
import type { CoachingRelationship } from "../types/coaching";
import type { WorkoutPlan } from "../types/plans";
import LoadingScreen from "../ui/LoadingScreen";

export default function DashboardPage() {
  const { user } = useAuth();
  const isTrainer = user!.roles.includes("ROLE_TRAINER");

  if (isTrainer) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-2">Area Trainer</h1>
        <p className="text-stone-400">In arrivo nella prossima fetta.</p>
      </div>
    );
  }

  return <AthleteDashboard />;
}

function AthleteDashboard() {
  const [invites, setInvites] = useState<CoachingRelationship[]>([]);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [invitesPage, activePlan] = await Promise.all([
          listCoaching("PENDING"),
          getMyPlan().catch((err: unknown) => {
            if (err instanceof AxiosError && err.response?.status === 404) return null;
            throw err;
          }),
        ]);
        setInvites(invitesPage.content);
        setPlan(activePlan);
      } catch {
        setError("Errore nel caricamento dei dati.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleAccept(id: string) {
    try {
      await acceptInvite(id);
      setInvites((prev) => prev.filter((inv) => inv.id !== id));
    } catch {
      // 409 = already handled, safe to remove
      setInvites((prev) => prev.filter((inv) => inv.id !== id));
    }
  }

  async function handleDecline(id: string) {
    try {
      await endRelationship(id);
      setInvites((prev) => prev.filter((inv) => inv.id !== id));
    } catch {
      setInvites((prev) => prev.filter((inv) => inv.id !== id));
    }
  }

  if (loading) return <LoadingScreen />;
  if (error) return <p className="text-red-400 py-10">{error}</p>;

  return (
    <div className="space-y-8">
      {invites.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Inviti in sospeso</h2>
          <div className="space-y-3">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-stone-800 px-4 py-3"
              >
                <p className="text-sm">
                  <span className="font-medium text-stone-200">
                    {inv.trainer.firstName} {inv.trainer.lastName}
                  </span>{" "}
                  <span className="text-stone-400">ti ha invitato</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(inv.id)}
                    className="rounded-md bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-950 hover:bg-white transition-colors cursor-pointer"
                  >
                    Accetta
                  </button>
                  <button
                    onClick={() => handleDecline(inv.id)}
                    className="rounded-md border border-stone-700 px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 hover:border-stone-500 transition-colors cursor-pointer"
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Il tuo piano</h2>
        {plan ? (
          <div>
            <p className="text-stone-400 mb-4">{plan.name}</p>
            <div className="space-y-2">
              {plan.days
                .toSorted((a, b) => a.orderIndex - b.orderIndex)
                .map((day) => (
                  <Link
                    key={day.id}
                    to={`/train/${day.id}`}
                    className="flex items-center justify-between rounded-lg border border-stone-800 px-4 py-3 hover:border-stone-600 transition-colors"
                  >
                    <span className="text-sm font-medium">{day.name}</span>
                    <span className="text-xs text-stone-500">
                      {day.exercises.length} esercizi &rarr;
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        ) : (
          <p className="text-stone-500">
            Nessun piano attivo — chiedi al tuo trainer di crearne uno.
          </p>
        )}
      </section>
    </div>
  );
}
