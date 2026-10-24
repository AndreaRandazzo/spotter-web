import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoSaveQueue } from "./AutoSaveQueue";
import type { QueueStorage, SendFn, QueueEntry } from "./AutoSaveQueue";

function makeStorage(
  initial: [string, QueueEntry][] = [],
): QueueStorage & { saved: [string, QueueEntry][] | null } {
  const store: { saved: [string, QueueEntry][] | null } = { saved: null };
  return {
    ...store,
    load: () => structuredClone(initial),
    save(entries) {
      store.saved = entries;
    },
  };
}

function makeSendFn() {
  const calls: {
    entry: QueueEntry;
    resolve: () => void;
    reject: (err: unknown) => void;
  }[] = [];

  const fn: SendFn = (entry) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ entry: structuredClone(entry), resolve, reject });
    });

  return { fn, calls };
}

function makeEntry(overrides: Partial<QueueEntry> = {}): QueueEntry {
  return {
    type: "put",
    sessionId: "s1",
    exerciseLogId: "e1",
    setNumber: 1,
    data: { reps: 10 },
    version: 1,
    status: "pending",
    retryCount: 0,
    ...overrides,
  };
}

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

describe("AutoSaveQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("two enqueues on the same set produce a single entry", () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    q.enqueue("s1", "e1", 1, "put", { reps: 12 });

    expect(calls).toHaveLength(1);
    expect(q.getEntryStatus("e1", 1)).toBe("pending");

    q.dispose();
  });

  it("modification during inflight: final value reaches the server", async () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    expect(calls).toHaveLength(1);
    expect(calls[0].entry.data).toEqual({ reps: 10 });

    q.enqueue("s1", "e1", 1, "put", { reps: 15 });
    expect(calls).toHaveLength(1);

    calls[0].resolve();
    await flush();

    expect(calls).toHaveLength(2);
    expect(calls[1].entry.data).toEqual({ reps: 15 });

    calls[1].resolve();
    await flush();

    expect(q.getEntryStatus("e1", 1)).toBe("synced");

    q.dispose();
  });

  it("never two concurrent requests on the same key", async () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    q.enqueue("s1", "e1", 1, "put", { reps: 12 });
    q.enqueue("s1", "e1", 1, "put", { reps: 14 });

    expect(calls).toHaveLength(1);

    calls[0].resolve();
    await flush();

    expect(calls).toHaveLength(2);
    expect(calls[1].entry.data).toEqual({ reps: 14 });

    q.dispose();
  });

  it("allows parallel requests for different keys", () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    q.enqueue("s1", "e1", 2, "put", { reps: 8 });

    expect(calls).toHaveLength(2);

    q.dispose();
  });

  it("DELETE replaces a pending PUT", async () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    expect(calls).toHaveLength(1);
    expect(calls[0].entry.type).toBe("put");

    q.enqueue("s1", "e1", 1, "delete", null);
    expect(calls).toHaveLength(1);

    calls[0].resolve();
    await flush();

    expect(calls).toHaveLength(2);
    expect(calls[1].entry.type).toBe("delete");

    calls[1].resolve();
    await flush();

    expect(q.getEntryStatus("e1", 1)).toBe("synced");

    q.dispose();
  });

  it("persistence: recreated queue has entries, inflight reset to pending", () => {
    const persistedEntries: [string, QueueEntry][] = [
      ["e1:1", makeEntry({ version: 3, status: "pending" })],
      [
        "e1:2",
        makeEntry({
          setNumber: 2,
          version: 1,
          status: "error",
          errorMessage: "test",
        }),
      ],
    ];

    const storage = makeStorage(persistedEntries);
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    expect(q.getEntryStatus("e1", 1)).toBe("pending");
    expect(q.getEntryStatus("e1", 2)).toBe("pending");

    expect(calls).toHaveLength(2);
    expect(calls[0].entry.retryCount).toBe(0);
    expect(calls[1].entry.retryCount).toBe(0);

    q.dispose();
  });

  it("401: entry kept, queue stops processing", async () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    q.enqueue("s1", "e1", 2, "put", { reps: 8 });

    expect(calls).toHaveLength(2);

    calls[0].reject({ status: 401 });
    await flush();

    expect(q.needsReauth).toBe(true);

    q.enqueue("s1", "e1", 3, "put", { reps: 6 });
    expect(calls).toHaveLength(2);

    q.dispose();
  });

  it("409: entry set to permanent error", async () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    calls[0].reject({ status: 409 });
    await flush();

    expect(q.getEntryStatus("e1", 1)).toBe("error");
    expect(q.getEntryError("e1", 1)).toBe("Sessione già completata");

    q.dispose();
  });

  it("network error: retry with exponential backoff", async () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    expect(calls).toHaveLength(1);

    calls[0].reject(new Error("network"));
    await flush();

    expect(q.getEntryStatus("e1", 1)).toBe("error");
    expect(q.getEntryError("e1", 1)).toBe("Errore di rete, riprovo…");

    // First backoff: 1s
    await vi.advanceTimersByTimeAsync(1000);
    await flush();

    expect(calls).toHaveLength(2);

    // Second failure
    calls[1].reject(new Error("network"));
    await flush();

    // Second backoff: 2s
    await vi.advanceTimersByTimeAsync(2000);
    await flush();

    expect(calls).toHaveLength(3);

    // Third attempt succeeds
    calls[2].resolve();
    await flush();

    expect(q.getEntryStatus("e1", 1)).toBe("synced");

    q.dispose();
  });

  it("subscriber is notified on state changes", async () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    const listener = vi.fn();
    const unsub = q.subscribe(listener);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    expect(listener).toHaveBeenCalled();

    calls[0].resolve();
    await flush();

    expect(listener.mock.calls.length).toBeGreaterThan(1);

    unsub();
    q.dispose();
  });

  it("hasPending accounts for inflight requests", () => {
    const storage = makeStorage();
    const { fn } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    expect(q.hasPending).toBe(false);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    expect(q.hasPending).toBe(true);

    q.dispose();
  });

  it("handles non-sequential set numbers from max+1 numbering", () => {
    const storage = makeStorage();
    const { fn } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    q.enqueue("s1", "e1", 2, "put", { reps: 10 });
    q.enqueue("s1", "e1", 3, "put", { reps: 10 });
    q.enqueue("s1", "e1", 2, "delete", null);
    q.enqueue("s1", "e1", 4, "put", { reps: 10 });

    expect(q.getEntryStatus("e1", 4)).toBe("pending");

    q.dispose();
  });
});
