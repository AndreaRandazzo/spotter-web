import { useState, useRef, useCallback, useEffect } from "react";
import type { LogSetRequest } from "../types/sessions";

interface SetRowProps {
  setNumber: number;
  initialReps: number | null;
  initialWeight: number | null;
  initialRpe: number | null;
  initialIsWarmup: boolean;
  onSave: (data: LogSetRequest) => void;
  onDelete: () => void;
  syncStatus: "synced" | "pending" | "error";
  errorMessage?: string;
}

export default function SetRow({
  setNumber,
  initialReps,
  initialWeight,
  initialRpe,
  initialIsWarmup,
  onSave,
  onDelete,
  syncStatus,
  errorMessage,
}: SetRowProps) {
  const [reps, setReps] = useState(initialReps?.toString() ?? "");
  const [weight, setWeight] = useState(initialWeight?.toString() ?? "");
  const [rpe, setRpe] = useState(initialRpe?.toString() ?? "");
  const [isWarmup, setIsWarmup] = useState(initialIsWarmup);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const save = useCallback(() => {
    const r = parseInt(reps, 10);
    if (!r || r <= 0) return;
    const w = parseFloat(weight) || undefined;
    const p = parseFloat(rpe) || undefined;
    onSaveRef.current({ reps: r, weight: w, rpe: p, isWarmup });
  }, [reps, weight, rpe, isWarmup]);

  function handleWarmupChange() {
    const next = !isWarmup;
    setIsWarmup(next);
    const r = parseInt(reps, 10);
    if (!r || r <= 0) return;
    const w = parseFloat(weight) || undefined;
    const p = parseFloat(rpe) || undefined;
    onSaveRef.current({ reps: r, weight: w, rpe: p, isWarmup: next });
  }

  const statusDot =
    syncStatus === "synced"
      ? "bg-green-500"
      : syncStatus === "pending"
        ? "bg-amber-500 animate-pulse"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2 py-2">
      <span className="w-6 text-center text-xs text-stone-400 shrink-0">
        {isWarmup ? "W" : setNumber}
      </span>

      <input
        type="number"
        inputMode="numeric"
        placeholder="Reps"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={save}
        className="w-16 rounded bg-stone-800 px-2 py-1.5 text-sm text-stone-100 outline-none focus:ring-1 focus:ring-stone-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <input
        type="number"
        inputMode="decimal"
        placeholder="kg"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={save}
        className="w-18 rounded bg-stone-800 px-2 py-1.5 text-sm text-stone-100 outline-none focus:ring-1 focus:ring-stone-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <input
        type="number"
        inputMode="decimal"
        placeholder="RPE"
        value={rpe}
        onChange={(e) => setRpe(e.target.value)}
        onBlur={save}
        className="w-14 rounded bg-stone-800 px-2 py-1.5 text-sm text-stone-100 outline-none focus:ring-1 focus:ring-stone-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <label className="flex items-center shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={isWarmup}
          onChange={handleWarmupChange}
          className="sr-only peer"
        />
        <span className="w-5 h-5 rounded border border-stone-600 flex items-center justify-center text-xs peer-checked:bg-stone-600 peer-checked:text-white text-transparent select-none">
          W
        </span>
      </label>

      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 text-stone-500 hover:text-red-400 transition-colors text-sm px-1"
        aria-label="Elimina serie"
      >
        &times;
      </button>

      <span
        className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`}
        title={errorMessage ?? syncStatus}
      />
    </div>
  );
}
