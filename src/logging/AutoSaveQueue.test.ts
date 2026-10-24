import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoSaveQueue } from "./AutoSaveQueue";
import type { QueueStorage, SendFn, QueueEntry } from "./AutoSaveQueue";
import { nextSetNumber } from "./nextSetNumber";

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

  it("persistence: inflight entries reset to pending on reload", () => {
    const persistedEntries: [string, QueueEntry][] = [
      ["e1:1", makeEntry({ version: 3, status: "inflight" })],
      ["e1:2", makeEntry({ setNumber: 2, version: 1, status: "pending" })],
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

  it("persistence: permanent error stays in error after reload", () => {
    const persistedEntries: [string, QueueEntry][] = [
      [
        "e1:1",
        makeEntry({
          status: "error",
          errorMessage: "Sessione già completata",
        }),
      ],
      ["e1:2", makeEntry({ setNumber: 2, status: "retrying" })],
    ];

    const storage = makeStorage(persistedEntries);
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    expect(q.getEntryStatus("e1", 1)).toBe("error");
    expect(q.getEntryError("e1", 1)).toBe("Sessione già completata");

    expect(q.getEntryStatus("e1", 2)).toBe("pending");
    expect(calls).toHaveLength(1);

    q.dispose();
  });

  it("401: queue stops, resume sends all pending including blocked entry", async () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    q.enqueue("s1", "e1", 2, "put", { reps: 8 });
    expect(calls).toHaveLength(2);

    calls[0].reject({ status: 401 });
    await flush();
    expect(q.needsReauth).toBe(true);

    calls[1].resolve();
    await flush();

    q.enqueue("s1", "e1", 3, "put", { reps: 6 });
    expect(calls).toHaveLength(2);

    q.resume();
    await flush();

    expect(q.needsReauth).toBe(false);
    expect(calls).toHaveLength(4);

    calls[2].resolve();
    calls[3].resolve();
    await flush();

    expect(q.getEntryStatus("e1", 1)).toBe("synced");
    expect(q.getEntryStatus("e1", 2)).toBe("synced");
    expect(q.getEntryStatus("e1", 3)).toBe("synced");

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

  it("network error: status is retrying, hasPending is true", async () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });
    calls[0].reject(new Error("network"));
    await flush();

    expect(q.getEntryStatus("e1", 1)).toBe("retrying");
    expect(q.getEntryError("e1", 1)).toBe("Errore di rete, riprovo…");
    expect(q.hasPending).toBe(true);

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
    expect(q.getEntryStatus("e1", 1)).toBe("retrying");

    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(calls).toHaveLength(2);

    calls[1].reject(new Error("network"));
    await flush();

    await vi.advanceTimersByTimeAsync(2000);
    await flush();
    expect(calls).toHaveLength(3);

    calls[2].resolve();
    await flush();
    expect(q.getEntryStatus("e1", 1)).toBe("synced");

    q.dispose();
  });

  it("retryNow bypasses 30s backoff and sends immediately", async () => {
    const storage = makeStorage();
    const { fn, calls } = makeSendFn();
    const q = new AutoSaveQueue(storage, fn);

    q.enqueue("s1", "e1", 1, "put", { reps: 10 });

    for (let i = 0; i < 6; i++) {
      calls[i].reject(new Error("network"));
      await flush();
      if (i < 5) {
        await vi.advanceTimersByTimeAsync(Math.min(1000 * 2 ** i, 30_000));
        await flush();
      }
    }
    expect(q.getEntryStatus("e1", 1)).toBe("retrying");

    q.retryNow();
    await flush();

    expect(calls).toHaveLength(7);

    calls[6].resolve();
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
});

describe("nextSetNumber", () => {
  it("returns 1 for an empty list", () => {
    expect(nextSetNumber([])).toBe(1);
  });

  it("returns max + 1 with gaps", () => {
    expect(nextSetNumber([{ setNumber: 1 }, { setNumber: 3 }])).toBe(4);
  });

  it("returns max + 1 after deletion", () => {
    const sets = [{ setNumber: 1 }, { setNumber: 2 }, { setNumber: 3 }];
    const afterDelete = sets.filter((s) => s.setNumber !== 2);
    expect(nextSetNumber(afterDelete)).toBe(4);
  });
});
