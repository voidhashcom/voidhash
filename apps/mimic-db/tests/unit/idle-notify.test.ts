import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  IDLE_DIRTY_SEQ_KEY,
  IDLE_NOTIFIED_SEQ_KEY,
  makeIdleNotifier,
  type IdleNotifyStorage,
} from "../../src/ws/idle-notify.ts";

interface Published {
  readonly collectionId: string;
  readonly documentId: string;
  readonly seq: number;
}

const makeHarness = (options?: {
  readonly authenticatedCount?: () => number;
  readonly publishFails?: boolean;
}) => {
  const store = new Map<string, number>();
  const alarms: number[] = [];
  const published: Published[] = [];
  const storage: IdleNotifyStorage = {
    get: (key) => Effect.sync(() => store.get(key)),
    put: (key, value) =>
      Effect.sync(() => {
        store.set(key, value);
      }),
    setAlarm: (scheduledTime) =>
      Effect.sync(() => {
        alarms.push(scheduledTime);
      }),
  };
  let now = 1_000;
  const notifier = makeIdleNotifier({
    collectionId: "col-1",
    documentId: "doc-1",
    storage,
    debounceMs: 15_000,
    now: () => now,
    authenticatedCount: options?.authenticatedCount ?? (() => 0),
    publish: (message) =>
      options?.publishFails
        ? Effect.fail(new Error("queue down"))
        : Effect.sync(() => {
            published.push(message);
          }),
  });
  return {
    notifier,
    store,
    alarms,
    published,
    setNow: (value: number) => {
      now = value;
    },
  };
};

describe("idle notifier", () => {
  it("records the dirty sequence on an accepted transaction", async () => {
    const h = makeHarness();
    await Effect.runPromise(h.notifier.recordDirty(7));
    expect(h.store.get(IDLE_DIRTY_SEQ_KEY)).toBe(7);
  });

  it("arms the debounce alarm when the last socket leaves a dirty document", async () => {
    const h = makeHarness();
    await Effect.runPromise(h.notifier.recordDirty(3));
    await Effect.runPromise(h.notifier.onLastAuthenticatedClose());
    expect(h.alarms).toEqual([1_000 + 15_000]);
  });

  it("does not arm an alarm when nothing new has been edited", async () => {
    const h = makeHarness();
    h.store.set(IDLE_DIRTY_SEQ_KEY, 5);
    h.store.set(IDLE_NOTIFIED_SEQ_KEY, 5);
    await Effect.runPromise(h.notifier.onLastAuthenticatedClose());
    expect(h.alarms).toEqual([]);
  });

  it("does not arm an alarm while authenticated sockets remain", async () => {
    const h = makeHarness({ authenticatedCount: () => 1 });
    await Effect.runPromise(h.notifier.recordDirty(9));
    await Effect.runPromise(h.notifier.onLastAuthenticatedClose());
    expect(h.alarms).toEqual([]);
  });

  it("publishes the dirty sequence and records it as notified on alarm", async () => {
    const h = makeHarness();
    await Effect.runPromise(h.notifier.recordDirty(4));
    await Effect.runPromise(h.notifier.onAlarm());
    expect(h.published).toEqual([{ collectionId: "col-1", documentId: "doc-1", seq: 4 }]);
    expect(h.store.get(IDLE_NOTIFIED_SEQ_KEY)).toBe(4);
  });

  it("skips publishing on alarm when a socket reconnected", async () => {
    const h = makeHarness({ authenticatedCount: () => 1 });
    await Effect.runPromise(h.notifier.recordDirty(4));
    await Effect.runPromise(h.notifier.onAlarm());
    expect(h.published).toEqual([]);
    expect(h.store.get(IDLE_NOTIFIED_SEQ_KEY)).toBeUndefined();
  });

  it("does not re-notify an already-notified sequence", async () => {
    const h = makeHarness();
    h.store.set(IDLE_DIRTY_SEQ_KEY, 6);
    h.store.set(IDLE_NOTIFIED_SEQ_KEY, 6);
    await Effect.runPromise(h.notifier.onAlarm());
    expect(h.published).toEqual([]);
  });

  it("leaves notifiedSeq unpersisted when the publish fails", async () => {
    const h = makeHarness({ publishFails: true });
    await Effect.runPromise(h.notifier.recordDirty(8));
    await Effect.runPromise(h.notifier.onAlarm());
    expect(h.store.get(IDLE_NOTIFIED_SEQ_KEY)).toBeUndefined();
    // The dirty seq is untouched, so the next disconnect re-triggers.
    expect(h.store.get(IDLE_DIRTY_SEQ_KEY)).toBe(8);
  });
});
