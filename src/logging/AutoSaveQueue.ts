type EntryType = "put" | "delete";

interface EntryData {
  reps: number;
  weight?: number;
  rpe?: number;
  isWarmup?: boolean;
}

export interface QueueEntry {
  type: EntryType;
  sessionId: string;
  exerciseLogId: string;
  setNumber: number;
  data: EntryData | null;
  version: number;
  status: "pending" | "error";
  errorMessage?: string;
  retryCount: number;
}

export interface QueueStorage {
  load(): [string, QueueEntry][];
  save(entries: [string, QueueEntry][]): void;
}

export type SendFn = (entry: QueueEntry) => Promise<void>;

function entryKey(exerciseLogId: string, setNumber: number) {
  return `${exerciseLogId}:${setNumber}`;
}

export class AutoSaveQueue {
  #queue: Map<string, QueueEntry>;
  #inflightKeys = new Set<string>();
  #needsReauth = false;
  #version = 0;
  #listeners = new Set<() => void>();
  #retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  #storage: QueueStorage;
  #sendFn: SendFn;

  constructor(storage: QueueStorage, sendFn: SendFn) {
    this.#storage = storage;
    this.#sendFn = sendFn;
    const entries = storage.load();
    this.#queue = new Map(
      entries.map(([key, entry]) => [
        key,
        { ...entry, status: "pending" as const, retryCount: 0 },
      ]),
    );
    this.flush();
  }

  enqueue(
    sessionId: string,
    exerciseLogId: string,
    setNumber: number,
    type: EntryType,
    data: EntryData | null,
  ): void {
    const key = entryKey(exerciseLogId, setNumber);
    const existing = this.#queue.get(key);
    const version = (existing?.version ?? 0) + 1;

    const timer = this.#retryTimers.get(key);
    if (timer != null) {
      clearTimeout(timer);
      this.#retryTimers.delete(key);
    }

    this.#queue.set(key, {
      type,
      sessionId,
      exerciseLogId,
      setNumber,
      data,
      version,
      status: "pending",
      retryCount: 0,
    });

    this.persist();
    this.notify();
    this.flush();
  }

  getEntryStatus(
    exerciseLogId: string,
    setNumber: number,
  ): "synced" | "pending" | "error" {
    const key = entryKey(exerciseLogId, setNumber);
    const entry = this.#queue.get(key);
    if (!entry) return "synced";
    if (entry.status === "error") return "error";
    return "pending";
  }

  getEntryError(exerciseLogId: string, setNumber: number): string | undefined {
    const key = entryKey(exerciseLogId, setNumber);
    return this.#queue.get(key)?.errorMessage;
  }

  get pendingCount(): number {
    return [...this.#queue.values()].filter((e) => e.status === "pending")
      .length;
  }

  get errorCount(): number {
    return [...this.#queue.values()].filter(
      (e) =>
        e.status === "error" &&
        e.errorMessage !== "Errore di rete, riprovo…",
    ).length;
  }

  get hasPending(): boolean {
    return this.pendingCount > 0 || this.#inflightKeys.size > 0;
  }

  get needsReauth(): boolean {
    return this.#needsReauth;
  }

  get version(): number {
    return this.#version;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  dispose(): void {
    for (const timer of this.#retryTimers.values()) {
      clearTimeout(timer);
    }
    this.#retryTimers.clear();
    this.#listeners.clear();
  }

  flush(): void {
    if (this.#needsReauth) return;

    const pending = [...this.#queue.entries()].filter(
      ([key, entry]) =>
        entry.status === "pending" && !this.#inflightKeys.has(key),
    );

    for (const [key, entry] of pending) {
      this.send(key, entry);
    }
  }

  send(key: string, entry: QueueEntry): void {
    const capturedVersion = entry.version;
    this.#inflightKeys.add(key);
    this.notify();

    this.#sendFn(entry)
      .then(() => {
        const current = this.#queue.get(key);
        if (current && current.version === capturedVersion) {
          this.#queue.delete(key);
        }
      })
      .catch((err: unknown) => {
        const status =
          err != null &&
          typeof err === "object" &&
          "status" in err &&
          typeof (err as { status: unknown }).status === "number"
            ? (err as { status: number }).status
            : null;

        if (status === 401) {
          this.#needsReauth = true;
          return;
        }

        if (status === 409) {
          const current = this.#queue.get(key);
          if (current && current.version === capturedVersion) {
            this.#queue.set(key, {
              ...current,
              status: "error",
              errorMessage: "Sessione già completata",
            });
          }
          return;
        }

        const current = this.#queue.get(key);
        if (current && current.version === capturedVersion) {
          const delay = Math.min(1000 * 2 ** current.retryCount, 30_000);
          const timer = setTimeout(() => {
            this.#retryTimers.delete(key);
            const c = this.#queue.get(key);
            if (
              c &&
              c.version === capturedVersion &&
              c.status === "error"
            ) {
              this.#queue.set(key, { ...c, status: "pending" });
              this.persist();
              this.notify();
              this.flush();
            }
          }, delay);
          this.#retryTimers.set(key, timer);

          this.#queue.set(key, {
            ...current,
            status: "error",
            errorMessage: "Errore di rete, riprovo…",
            retryCount: current.retryCount + 1,
          });
        }
      })
      .finally(() => {
        this.#inflightKeys.delete(key);
        this.persist();
        this.notify();
        this.flush();
      });
  }

  persist(): void {
    this.#storage.save([...this.#queue]);
  }

  notify(): void {
    this.#version++;
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
