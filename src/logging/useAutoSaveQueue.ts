import { useState, useCallback, useSyncExternalStore, useEffect } from "react";
import { AutoSaveQueue } from "./AutoSaveQueue";
import type { QueueStorage, SendFn } from "./AutoSaveQueue";
import { logSet, deleteSet } from "../api/sessions";
import type { LogSetRequest } from "../types/sessions";
import { AxiosError } from "axios";

function storageKey(userId: string) {
  return `spotter_queue_${userId}`;
}

function makeStorage(userId: string): QueueStorage {
  return {
    load() {
      try {
        const raw = localStorage.getItem(storageKey(userId));
        if (!raw) return [];
        return JSON.parse(raw);
      } catch {
        return [];
      }
    },
    save(entries) {
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(entries));
      } catch {
        // storage full — silent
      }
    },
  };
}

const sendFn: SendFn = async (entry) => {
  try {
    if (entry.type === "put" && entry.data) {
      await logSet(
        entry.sessionId,
        entry.exerciseLogId,
        entry.setNumber,
        entry.data as LogSetRequest,
      );
    } else {
      await deleteSet(entry.sessionId, entry.exerciseLogId, entry.setNumber);
    }
  } catch (err) {
    if (err instanceof AxiosError && err.response) {
      throw { status: err.response.status };
    }
    throw err;
  }
};

export function useAutoSaveQueue(userId: string) {
  const [queue] = useState(
    () => new AutoSaveQueue(makeStorage(userId), sendFn),
  );

  useEffect(() => {
    return () => queue.dispose();
  }, [queue]);

  useSyncExternalStore(
    useCallback((cb: () => void) => queue.subscribe(cb), [queue]),
    useCallback(() => queue.version, [queue]),
  );

  const enqueue = useCallback(
    (
      sessionId: string,
      exerciseLogId: string,
      setNumber: number,
      type: "put" | "delete",
      data: LogSetRequest | null,
    ) => {
      queue.enqueue(sessionId, exerciseLogId, setNumber, type, data);
    },
    [queue],
  );

  const getEntryStatus = useCallback(
    (exerciseLogId: string, setNumber: number) =>
      queue.getEntryStatus(exerciseLogId, setNumber),
    [queue],
  );

  const getEntryError = useCallback(
    (exerciseLogId: string, setNumber: number) =>
      queue.getEntryError(exerciseLogId, setNumber),
    [queue],
  );

  return {
    enqueue,
    getEntryStatus,
    getEntryError,
    pendingCount: queue.pendingCount,
    errorCount: queue.errorCount,
    hasPending: queue.hasPending,
    needsReauth: queue.needsReauth,
  };
}
