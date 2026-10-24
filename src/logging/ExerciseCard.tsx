import type { PlanExercise } from "../types/plans";
import SetRow from "./SetRow";
import type { LogSetRequest } from "../types/sessions";

interface LocalSet {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  isWarmup: boolean;
}

interface ExerciseCardProps {
  sessionId: string;
  exerciseLogId: string;
  exerciseName: string;
  planExercise: PlanExercise | undefined;
  sets: LocalSet[];
  onAddSet: () => void;
  onSaveSet: (setNumber: number, data: LogSetRequest) => void;
  onDeleteSet: (setNumber: number) => void;
  getStatus: (setNumber: number) => "synced" | "pending" | "retrying" | "error";
  getError: (setNumber: number) => string | undefined;
  disabled: boolean;
}

export default function ExerciseCard({
  sessionId,
  exerciseLogId,
  exerciseName,
  planExercise,
  sets,
  onAddSet,
  onSaveSet,
  onDeleteSet,
  getStatus,
  getError,
  disabled,
}: ExerciseCardProps) {
  return (
    <section className="rounded-lg border border-stone-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-800">
        <h2 className="font-semibold">{exerciseName}</h2>
        {planExercise && (
          <p className="text-xs text-stone-400 mt-0.5">
            Obiettivo: {planExercise.targetSets} &times;{" "}
            {planExercise.targetReps}
            {planExercise.targetRpe != null && ` @ RPE ${planExercise.targetRpe}`}
            {planExercise.restSeconds != null &&
              ` · ${planExercise.restSeconds}s rec.`}
          </p>
        )}
      </div>

      <div className="px-4">
        {sets.length > 0 && (
          <div className="flex items-center gap-2 py-1.5 text-xs text-stone-500">
            <span className="w-6 text-center">#</span>
            <span className="w-16">Reps</span>
            <span className="w-18">Peso</span>
            <span className="w-14">RPE</span>
            <span className="w-5" />
            <span className="px-1" />
            <span className="w-2" />
          </div>
        )}

        {sets
          .toSorted((a, b) => a.setNumber - b.setNumber)
          .map((set) => (
            <SetRow
              key={set.setNumber}
              setNumber={set.setNumber}
              initialReps={set.reps}
              initialWeight={set.weight}
              initialRpe={set.rpe}
              initialIsWarmup={set.isWarmup}
              draftKey={`spotter_draft_${sessionId}_${exerciseLogId}_${set.setNumber}`}
              onSave={(data) => onSaveSet(set.setNumber, data)}
              onDelete={() => onDeleteSet(set.setNumber)}
              syncStatus={getStatus(set.setNumber)}
              errorMessage={getError(set.setNumber)}
            />
          ))}
      </div>

      <div className="px-4 py-3 border-t border-stone-800">
        <button
          type="button"
          onClick={onAddSet}
          disabled={disabled}
          className="text-sm text-stone-400 hover:text-stone-200 transition-colors disabled:opacity-50"
        >
          + Aggiungi serie
        </button>
      </div>
    </section>
  );
}

export type { LocalSet };
