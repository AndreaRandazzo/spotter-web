import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth";
import { startSession, getSession, completeSession } from "../api/sessions";
import { getMyPlan } from "../api/plans";
import type { WorkoutSession } from "../types/sessions";
import type { PlanDay, PlanExercise } from "../types/plans";
import type { LogSetRequest } from "../types/sessions";
import { useAutoSaveQueue } from "../logging/useAutoSaveQueue";
import ExerciseCard from "../logging/ExerciseCard";
import type { LocalSet } from "../logging/ExerciseCard";
import { nextSetNumber } from "../logging/nextSetNumber";
import LoadingScreen from "../ui/LoadingScreen";

function sessionKey(userId: string, dayId: string) {
  return `spotter_session_${userId}_${dayId}`;
}

export default function LoggingPage() {
  const { dayId } = useParams<{ dayId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exerciseSets, setExerciseSets] = useState<Map<string, LocalSet[]>>(
    new Map(),
  );
  const [planDay, setPlanDay] = useState<PlanDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const queue = useAutoSaveQueue(user!.id);

  useEffect(() => {
    if (!dayId || !user) return;

    async function init() {
      try {
        const key = sessionKey(user!.id, dayId!);
        const savedId = localStorage.getItem(key);

        let ws: WorkoutSession;

        if (savedId) {
          try {
            ws = await getSession(savedId);
            if (ws.status === "COMPLETED") {
              localStorage.removeItem(key);
              const newId = crypto.randomUUID();
              ws = await startSession(newId, dayId!);
              localStorage.setItem(key, newId);
            }
          } catch {
            localStorage.removeItem(key);
            const newId = crypto.randomUUID();
            ws = await startSession(newId, dayId!);
            localStorage.setItem(key, newId);
          }
        } else {
          const newId = crypto.randomUUID();
          ws = await startSession(newId, dayId!);
          localStorage.setItem(key, newId);
        }

        setSession(ws);

        const sets = new Map<string, LocalSet[]>();
        for (const el of ws.exerciseLogs) {
          sets.set(
            el.id,
            el.sets.map((s) => ({
              setNumber: s.setNumber,
              reps: s.reps,
              weight: s.weight,
              rpe: s.rpe,
              isWarmup: s.isWarmup,
            })),
          );
        }
        setExerciseSets(sets);

        try {
          const plan = await getMyPlan();
          const day = plan.days.find((d) => d.id === dayId);
          if (day) setPlanDay(day);
        } catch {
          // proceed without plan targets
        }
      } catch {
        setError("Impossibile avviare la sessione. Controlla la connessione.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [dayId, user]);

  const handleAddSet = useCallback(
    (exerciseLogId: string) => {
      setExerciseSets((prev) => {
        const next = new Map(prev);
        const sets = next.get(exerciseLogId) ?? [];
        next.set(exerciseLogId, [
          ...sets,
          {
            setNumber: nextSetNumber(sets),
            reps: null,
            weight: null,
            rpe: null,
            isWarmup: false,
          },
        ]);
        return next;
      });
    },
    [],
  );

  const handleSaveSet = useCallback(
    (exerciseLogId: string, setNumber: number, data: LogSetRequest) => {
      if (!session) return;
      queue.enqueue(session.id, exerciseLogId, setNumber, "put", data);
    },
    [session, queue],
  );

  const handleDeleteSet = useCallback(
    (exerciseLogId: string, setNumber: number) => {
      if (!session) return;

      setExerciseSets((prev) => {
        const next = new Map(prev);
        const sets = (next.get(exerciseLogId) ?? []).filter(
          (s) => s.setNumber !== setNumber,
        );
        next.set(exerciseLogId, sets);
        return next;
      });

      queue.enqueue(session.id, exerciseLogId, setNumber, "delete", null);
    },
    [session, queue],
  );

  async function handleComplete() {
    if (!session || queue.hasPending) return;
    setCompleting(true);
    try {
      await completeSession(session.id);
      localStorage.removeItem(sessionKey(user!.id, dayId!));
      navigate(`/sessions/${session.id}`, { replace: true });
    } catch {
      setError("Errore nel completamento della sessione.");
      setCompleting(false);
    }
  }

  function findPlanExercise(exerciseId: string): PlanExercise | undefined {
    return planDay?.exercises.find((e) => e.exerciseId === exerciseId);
  }

  if (loading) return <LoadingScreen />;
  if (error && !session) {
    return <p className="text-red-400 py-10">{error}</p>;
  }

  const s = session!;
  const isCompleted = s.status === "COMPLETED";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{s.planDayName}</h1>
          <p className="text-xs text-stone-400 mt-1">
            Iniziata alle{" "}
            {new Date(s.startedAt).toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {queue.pendingCount > 0 && (
          <span className="text-xs text-amber-400 animate-pulse">
            Salvataggio…
          </span>
        )}
        {queue.errorCount > 0 && (
          <span className="text-xs text-red-400">
            {queue.errorCount} {queue.errorCount === 1 ? "errore" : "errori"}
          </span>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      <div className="space-y-4">
        {s.exerciseLogs
          .toSorted((a, b) => a.orderIndex - b.orderIndex)
          .map((el) => (
            <ExerciseCard
              key={el.id}
              sessionId={s.id}
              exerciseLogId={el.id}
              exerciseName={el.exerciseName}
              planExercise={findPlanExercise(el.exerciseId)}
              sets={exerciseSets.get(el.id) ?? []}
              onAddSet={() => handleAddSet(el.id)}
              onSaveSet={(setNum, data) => handleSaveSet(el.id, setNum, data)}
              onDeleteSet={(setNum) => handleDeleteSet(el.id, setNum)}
              getStatus={(setNum) => queue.getEntryStatus(el.id, setNum)}
              getError={(setNum) => queue.getEntryError(el.id, setNum)}
              disabled={isCompleted}
            />
          ))}
      </div>

      {!isCompleted && (
        <div className="mt-8 pb-8">
          <button
            type="button"
            onClick={handleComplete}
            disabled={queue.hasPending || completing}
            className="w-full rounded-lg bg-green-700 py-3 text-sm font-medium text-white hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {completing
              ? "Completamento…"
              : queue.hasPending
                ? "Salvataggio in corso…"
                : "Completa sessione"}
          </button>
        </div>
      )}
    </div>
  );
}
