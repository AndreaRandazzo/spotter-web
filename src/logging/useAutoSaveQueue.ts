import { useRef, useCallback, useSyncExternalStore, useEffect } from "react";
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

interface QueueSnapshot {
  version: number;
  pendingCount: number;
  errorCount: number;
  hasPending: boolean;
  needsReauth: boolean;
}

export function useAutoSaveQueue(userId: string) {
  const queueRef = useRef<AutoSaveQueue | null>(null);
  if (queueRef.current == null) {
    queueRef.current = new AutoSaveQueue(makeStorage(userId), sendFn);
  }

  const snapCache = useRef<QueueSnapshot>({
    version: -1,
    pendingCount: 0,
    errorCount: 0,
    hasPending: false,
    needsReauth: false,
  });

  useEffect(() => {
    const q = queueRef.current!;
    function handleOnline() {
      q.retryNow();
    }
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
      q.dispose();
    };
  }, []);

  const subscribe = useCallback(
    (cb: () => void) => queueRef.current!.subscribe(cb),
    [],
  );

  const getSnapshot = useCallback((): QueueSnapshot => {
    const q = queueRef.current!;
    const v = q.version;
    const prev = snapCache.current;
    if (prev.version === v) return prev;
    const next: QueueSnapshot = {
      version: v,
      pendingCount: q.pendingCount,
      errorCount: q.errorCount,
      hasPending: q.hasPending,
      needsReauth: q.needsReauth,
    };
    snapCache.current = next;
    return next;
  }, []);

  const { pendingCount, errorCount, hasPending, needsReauth } =
    useSyncExternalStore(subscribe, getSnapshot);

  const enqueue = useCallback(
    (
      sessionId: string,
      exerciseLogId: string,
      setNumber: number,
      type: "put" | "delete",
      data: LogSetRequest | null,
    ) => {
      queueRef.current!.enqueue(
        sessionId,
        exerciseLogId,
        setNumber,
        type,
        data,
      );
    },
    [],
  );

  const getEntryStatus = useCallback(
    (exerciseLogId: string, setNumber: number) =>
      queueRef.current!.getEntryStatus(exerciseLogId, setNumber),
    [],
  );

  const getEntryError = useCallback(
    (exerciseLogId: string, setNumber: number) =>
      queueRef.current!.getEntryError(exerciseLogId, setNumber),
    [],
  );

  const resume = useCallback(() => {
    queueRef.current!.resume();
  }, []);

  return {
    enqueue,
    getEntryStatus,
    getEntryError,
    resume,
    pendingCount,
    errorCount,
    hasPending,
    needsReauth,
  };
}
