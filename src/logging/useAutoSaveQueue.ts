import { useState, useEffect, useRef, useCallback } from "react";
import { logSet, deleteSet } from "../api/sessions";
import type { LogSetRequest } from "../types/sessions";
import { AxiosError } from "axios";

type EntryType = "put" | "delete";

interface QueueEntry {
  type: EntryType;
  sessionId: string;
  exerciseLogId: string;
  setNumber: number;
  data: LogSetRequest | null;
  version: number;
  status: "pending" | "error";
  errorMessage?: string;
  retryCount: number;
}

function storageKey(userId: string) {
  return `spotter_queue_${userId}`;
}

function entryKey(exerciseLogId: string, setNumber: number) {
  return `${exerciseLogId}:${setNumber}`;
}

function loadQueue(userId: string): Map<string, QueueEntry> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Map();
    const entries: [string, QueueEntry][] = JSON.parse(raw);
    return new Map(
      entries.map(([key, entry]) => [
        key,
        { ...entry, status: "pending" as const, retryCount: 0 },
      ]),
    );
  } catch {
    return new Map();
  }
}

function saveQueue(userId: string, queue: Map<string, QueueEntry>) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...queue]));
  } catch {
    // storage full — silent
  }
}

export function useAutoSaveQueue(userId: string) {
  const [queue, setQueue] = useState<Map<string, QueueEntry>>(() =>
    loadQueue(userId),
  );
  const [needsReauth, setNeedsReauth] = useState(false);
  const [inflightCount, setInflightCount] = useState(0);
  const inflightKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    saveQueue(userId, queue);
  }, [userId, queue]);

  useEffect(() => {
    if (needsReauth) return;

    const pending = [...queue.entries()].filter(
      ([key, entry]) =>
        entry.status === "pending" && !inflightKeys.current.has(key),
    );
    if (pending.length === 0) return;

    for (const [key, entry] of pending) {
      const capturedVersion = entry.version;
      inflightKeys.current.add(key);
      setInflightCount((c) => c + 1);

      const request =
        entry.type === "put" && entry.data
          ? logSet(
              entry.sessionId,
              entry.exerciseLogId,
              entry.setNumber,
              entry.data,
            ).then(() => {})
          : deleteSet(
              entry.sessionId,
              entry.exerciseLogId,
              entry.setNumber,
            );

      request
        .then(() => {
          setQueue((prev) => {
            const next = new Map(prev);
            const current = next.get(key);
            if (current && current.version === capturedVersion) {
              next.delete(key);
            }
            return next;
          });
        })
        .catch((err: unknown) => {
          if (err instanceof AxiosError) {
            if (err.response?.status === 401) {
              setNeedsReauth(true);
              return;
            }
            if (err.response?.status === 409) {
              setQueue((prev) => {
                const next = new Map(prev);
                const current = next.get(key);
                if (current && current.version === capturedVersion) {
                  next.set(key, {
                    ...current,
                    status: "error",
                    errorMessage: "Sessione già completata",
                  });
                }
                return next;
              });
              return;
            }
          }
          setQueue((prev) => {
            const next = new Map(prev);
            const current = next.get(key);
            if (current && current.version === capturedVersion) {
              const delay = Math.min(
                1000 * 2 ** current.retryCount,
                30_000,
              );
              setTimeout(() => {
                setQueue((prev2) => {
                  const next2 = new Map(prev2);
                  const c = next2.get(key);
                  if (
                    c &&
                    c.version === capturedVersion &&
                    c.status === "error"
                  ) {
                    next2.set(key, { ...c, status: "pending" });
                  }
                  return next2;
                });
              }, delay);
              next.set(key, {
                ...current,
                status: "error",
                errorMessage: "Errore di rete, riprovo…",
                retryCount: current.retryCount + 1,
              });
            }
            return next;
          });
        })
        .finally(() => {
          inflightKeys.current.delete(key);
          setInflightCount((c) => c - 1);
        });
    }
  }, [queue, needsReauth]);

  const enqueue = useCallback(
    (
      sessionId: string,
      exerciseLogId: string,
      setNumber: number,
      type: EntryType,
      data: LogSetRequest | null,
    ) => {
      const key = entryKey(exerciseLogId, setNumber);
      setQueue((prev) => {
        const existing = prev.get(key);
        const version = (existing?.version ?? 0) + 1;
        const next = new Map(prev);
        next.set(key, {
          type,
          sessionId,
          exerciseLogId,
          setNumber,
          data,
          version,
          status: "pending",
          retryCount: 0,
        });
        return next;
      });
    },
    [],
  );

  const getEntryStatus = useCallback(
    (
      exerciseLogId: string,
      setNumber: number,
    ): "synced" | "pending" | "error" => {
      const key = entryKey(exerciseLogId, setNumber);
      const entry = queue.get(key);
      if (!entry) return "synced";
      return entry.status === "error" ? "error" : "pending";
    },
    [queue],
  );

  const getEntryError = useCallback(
    (exerciseLogId: string, setNumber: number): string | undefined => {
      const key = entryKey(exerciseLogId, setNumber);
      return queue.get(key)?.errorMessage;
    },
    [queue],
  );

  const pendingCount = [...queue.values()].filter(
    (e) => e.status === "pending",
  ).length;

  const errorCount = [...queue.values()].filter(
    (e) =>
      e.status === "error" && e.errorMessage !== "Errore di rete, riprovo…",
  ).length;

  const hasPending = pendingCount > 0 || inflightCount > 0;

  return {
    enqueue,
    getEntryStatus,
    getEntryError,
    pendingCount,
    errorCount,
    hasPending,
    needsReauth,
  };
}
