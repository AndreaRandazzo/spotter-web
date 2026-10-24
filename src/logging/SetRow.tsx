import { useState, useRef, useCallback, useEffect } from "react";
import type { LogSetRequest } from "../types/sessions";

interface SetRowProps {
  setNumber: number;
  initialReps: number | null;
  initialWeight: number | null;
  initialRpe: number | null;
  initialIsWarmup: boolean;
  draftKey: string;
  onSave: (data: LogSetRequest) => void;
  onDelete: () => void;
  syncStatus: "synced" | "pending" | "retrying" | "error";
  errorMessage?: string;
}

interface Draft {
  reps: string;
  weight: string;
  rpe: string;
  isWarmup: boolean;
}

function loadDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveDraft(key: string, draft: Draft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // storage full
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // silent
  }
}

export default function SetRow({
  setNumber,
  initialReps,
  initialWeight,
  initialRpe,
  initialIsWarmup,
  draftKey,
  onSave,
  onDelete,
  syncStatus,
  errorMessage,
}: SetRowProps) {
  const draft = loadDraft(draftKey);

  const [reps, setReps] = useState(draft?.reps ?? initialReps?.toString() ?? "");
  const [weight, setWeight] = useState(
    draft?.weight ?? initialWeight?.toString() ?? "",
  );
  const [rpe, setRpe] = useState(draft?.rpe ?? initialRpe?.toString() ?? "");
  const [isWarmup, setIsWarmup] = useState(draft?.isWarmup ?? initialIsWarmup);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(
    (r: string, w: string, p: string, wu: boolean) => {
      const repsNum = parseInt(r, 10);
      if (!repsNum || repsNum <= 0) return;
      const weightNum = parseFloat(w) || undefined;
      const rpeNum = parseFloat(p) || undefined;
      onSaveRef.current({
        reps: repsNum,
        weight: weightNum,
        rpe: rpeNum,
        isWarmup: wu,
      });
      clearDraft(draftKey);
    },
    [draftKey],
  );

  const scheduleDebounce = useCallback(
    (r: string, w: string, p: string, wu: boolean) => {
      saveDraft(draftKey, { reps: r, weight: w, rpe: p, isWarmup: wu });
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        doSave(r, w, p, wu);
      }, 500);
    },
    [draftKey, doSave],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // If a draft existed at mount, enqueue it immediately
  useEffect(() => {
    if (draft) {
      doSave(draft.reps, draft.weight, draft.rpe, draft.isWarmup);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(
    field: "reps" | "weight" | "rpe",
    value: string,
  ) {
    const nextReps = field === "reps" ? value : reps;
    const nextWeight = field === "weight" ? value : weight;
    const nextRpe = field === "rpe" ? value : rpe;
    if (field === "reps") setReps(value);
    if (field === "weight") setWeight(value);
    if (field === "rpe") setRpe(value);
    scheduleDebounce(nextReps, nextWeight, nextRpe, isWarmup);
  }

  function handleBlur() {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    doSave(reps, weight, rpe, isWarmup);
  }

  function handleWarmupChange() {
    const next = !isWarmup;
    setIsWarmup(next);
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    saveDraft(draftKey, { reps, weight, rpe, isWarmup: next });
    doSave(reps, weight, rpe, next);
  }

  const statusDot =
    syncStatus === "synced"
      ? "bg-green-500"
      : syncStatus === "error"
        ? "bg-red-500"
        : "bg-amber-500 animate-pulse";

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
        onChange={(e) => handleChange("reps", e.target.value)}
        onBlur={handleBlur}
        className="w-16 rounded bg-stone-800 px-2 py-1.5 text-sm text-stone-100 outline-none focus:ring-1 focus:ring-stone-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <input
        type="number"
        inputMode="decimal"
        placeholder="kg"
        value={weight}
        onChange={(e) => handleChange("weight", e.target.value)}
        onBlur={handleBlur}
        className="w-18 rounded bg-stone-800 px-2 py-1.5 text-sm text-stone-100 outline-none focus:ring-1 focus:ring-stone-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <input
        type="number"
        inputMode="decimal"
        placeholder="RPE"
        value={rpe}
        onChange={(e) => handleChange("rpe", e.target.value)}
        onBlur={handleBlur}
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
