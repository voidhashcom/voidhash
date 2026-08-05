import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import {
  DurableEntityAlarmControl,
  DurableEntityHost,
  makeDurableEntityAddress,
  type DurableEntitySession,
} from "../DurableEntity.ts";

/** Wiring one adapter must supply for the durable entity conformance suite. */
export interface DurableEntityConformanceOptions {
  readonly name: string;
  /** Builds an isolated host; called once per test so state never leaks. */
  readonly layer: () => Layer.Layer<DurableEntityHost>;
  /** Adapters without a WebSocket story opt out of the session assertions. */
  readonly supportsSessions?: boolean;
  /**
   * Present when the adapter publishes {@link DurableEntityAlarmControl}; the
   * factory builds the host beside its control plane so the alarm-dispatch
   * assertions can drive both halves of one instance.
   */
  readonly supportsAlarmDispatch?: () => Layer.Layer<
    DurableEntityHost | DurableEntityAlarmControl
  >;
  /**
   * Present when the adapter refuses session work it does not own; the factory
   * builds a host whose shards belong to a different runner.
   */
  readonly requiresShardLocality?: () => Layer.Layer<DurableEntityHost>;
}

/** Records every frame and close a host delivered to one attached session. */
interface RecordingSession {
  readonly session: DurableEntitySession;
  readonly frames: Array<string | Uint8Array>;
  readonly closes: Array<{ readonly code?: number; readonly reason?: string }>;
}

const recordingSession = (id: string): RecordingSession => {
  const frames: Array<string | Uint8Array> = [];
  const closes: Array<{ readonly code?: number; readonly reason?: string }> = [];
  let attachment: unknown;
  return {
    frames,
    closes,
    session: {
      id,
      send: (message) => Effect.sync(() => void frames.push(message)),
      close: (code, reason) => Effect.sync(() => void closes.push({ code, reason })),
      getAttachment: Effect.sync(() => attachment),
      setAttachment: (next) =>
        Effect.sync(() => {
          attachment = next;
        }),
    },
  };
};

const testSession = (id: string): DurableEntitySession => recordingSession(id).session;

/**
 * Behaviour every durable entity host must exhibit: operations on one address
 * run one at a time, different addresses make progress independently, and
 * entity-local state outlives the operation that wrote it.
 */
export const durableEntityHostConformance = (
  options: DurableEntityConformanceOptions,
): void => {
  const runWith = <A, E, R>(
    layer: Layer.Layer<R>,
    effect: Effect.Effect<A, E, R>,
  ): Promise<A> =>
    Effect.runPromise(
      Effect.scoped(effect.pipe(Effect.provide(layer))) as Effect.Effect<A, E>,
    );

  const run = <A, E>(effect: Effect.Effect<A, E, DurableEntityHost>): Promise<A> =>
    runWith(options.layer(), effect);

  describe(`${options.name}: durable entity host conformance`, () => {
    it("serializes one address while letting different addresses overlap", async () => {
      const events: Array<string> = [];
      const first = makeDurableEntityAddress("document", "first");
      const second = makeDurableEntityAddress("document", "second");

      await run(
        Effect.gen(function* () {
          const host = yield* DurableEntityHost;
          yield* Effect.all(
            [
              host.run(first, () =>
                Effect.gen(function* () {
                  events.push("first:start");
                  yield* Effect.sleep("40 millis");
                  events.push("first:end");
                }),
              ),
              host.run(first, () => Effect.sync(() => void events.push("first:next"))),
              host.run(second, () =>
                Effect.gen(function* () {
                  events.push("second:start");
                  yield* Effect.sleep("5 millis");
                  events.push("second:end");
                }),
              ),
            ],
            { concurrency: "unbounded" },
          );
        }),
      );

      // The short second-address turn finishes before the long first-address
      // turn, and the queued first-address turn only starts once it is done.
      expect(events.indexOf("second:end")).toBeLessThan(events.indexOf("first:end"));
      expect(events.indexOf("first:end")).toBeLessThan(events.indexOf("first:next"));
    });

    it("retains key-value state across separate turns", async () => {
      const address = makeDurableEntityAddress("document", "stateful");

      const value = await run(
        Effect.gen(function* () {
          const host = yield* DurableEntityHost;
          yield* host.run(address, (entity) => entity.keyValue.put("value", { count: 1 }));
          return yield* host.run(address, (entity) => entity.keyValue.get("value"));
        }),
      );

      expect(value).toEqual({ count: 1 });
    });

    it("deletes key-value state", async () => {
      const address = makeDurableEntityAddress("document", "deletes");

      const value = await run(
        Effect.gen(function* () {
          const host = yield* DurableEntityHost;
          yield* host.run(address, (entity) => entity.keyValue.put("value", "present"));
          yield* host.run(address, (entity) => entity.keyValue.delete("value"));
          return yield* host.run(address, (entity) => entity.keyValue.get("value"));
        }),
      );

      expect(value).toBeUndefined();
    });

    it("round-trips a replaceable alarm", async () => {
      const address = makeDurableEntityAddress("document", "alarms");

      const [set, cleared] = await run(
        Effect.gen(function* () {
          const host = yield* DurableEntityHost;
          yield* host.run(address, (entity) => entity.alarm.set(1234));
          const set = yield* host.run(address, (entity) => entity.alarm.get);
          yield* host.run(address, (entity) => entity.alarm.delete);
          const cleared = yield* host.run(address, (entity) => entity.alarm.get);
          return [set, cleared] as const;
        }),
      );

      expect(set).toBe(1234);
      expect(cleared).toBeUndefined();
    });

    it("isolates state between addresses", async () => {
      const first = makeDurableEntityAddress("document", "isolated-a");
      const second = makeDurableEntityAddress("document", "isolated-b");

      const value = await run(
        Effect.gen(function* () {
          const host = yield* DurableEntityHost;
          yield* host.run(first, (entity) => entity.keyValue.put("value", "a"));
          return yield* host.run(second, (entity) => entity.keyValue.get("value"));
        }),
      );

      expect(value).toBeUndefined();
    });

    if (options.supportsSessions !== false) {
      it("tracks attached sessions", async () => {
        const address = makeDurableEntityAddress("document", "sessions");

        const [attached, remaining] = await run(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(address, (entity) => entity.sessions.attach(testSession("s-1")));
            const attached = yield* host.run(address, (entity) => entity.sessions.list);
            yield* host.run(address, (entity) => entity.sessions.remove("s-1"));
            const remaining = yield* host.run(address, (entity) => entity.sessions.list);
            return [attached, remaining] as const;
          }),
        );

        expect(attached.map((session) => session.id)).toEqual(["s-1"]);
        expect(remaining).toEqual([]);
      });

      it("replaces an attachment that reuses a session id", async () => {
        const address = makeDurableEntityAddress("document", "session-reattach");
        const first = recordingSession("s-1");
        const second = recordingSession("s-1");

        const sessions = await run(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(address, (entity) => entity.sessions.attach(first.session));
            yield* host.run(address, (entity) => entity.sessions.attach(second.session));
            return yield* host.run(address, (entity) => entity.sessions.list);
          }),
        );

        expect(sessions).toHaveLength(1);
        // Identity, not just the id: a reconnect must not keep delivering to
        // the socket it replaced.
        expect(sessions[0]).toBe(second.session);
      });

      it("looks sessions up by id and forgets unknown ids", async () => {
        const address = makeDurableEntityAddress("document", "session-lookup");

        const [found, missing, afterRemove] = await run(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(address, (entity) => entity.sessions.attach(testSession("s-1")));
            const found = yield* host.run(address, (entity) => entity.sessions.get("s-1"));
            const missing = yield* host.run(address, (entity) => entity.sessions.get("s-2"));
            // Removing an id that was never attached is a no-op, not an error.
            yield* host.run(address, (entity) => entity.sessions.remove("s-2"));
            yield* host.run(address, (entity) => entity.sessions.remove("s-1"));
            const afterRemove = yield* host.run(address, (entity) => entity.sessions.get("s-1"));
            return [found, missing, afterRemove] as const;
          }),
        );

        expect(found?.id).toBe("s-1");
        expect(missing).toBeUndefined();
        expect(afterRemove).toBeUndefined();
      });

      it("isolates sessions between addresses", async () => {
        const first = makeDurableEntityAddress("document", "session-isolated-a");
        const second = makeDurableEntityAddress("document", "session-isolated-b");

        const sessions = await run(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(first, (entity) => entity.sessions.attach(testSession("s-1")));
            return yield* host.run(second, (entity) => entity.sessions.list);
          }),
        );

        expect(sessions).toEqual([]);
      });

      it("drops sessions when the host is rebuilt", async () => {
        const address = makeDurableEntityAddress("document", `session-restart-${Date.now()}`);

        await run(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(address, (entity) => entity.sessions.attach(testSession("s-1")));
          }),
        );

        // A socket belongs to the process that holds it open, so a new host
        // must never resurrect one from storage.
        const sessions = await run(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            return yield* host.run(address, (entity) => entity.sessions.list);
          }),
        );

        expect(sessions).toEqual([]);
      });

      it("delivers text and binary frames to every attached session exactly once", async () => {
        const address = makeDurableEntityAddress("document", "session-delivery");
        const first = recordingSession("s-1");
        const second = recordingSession("s-2");
        const binary = new Uint8Array([1, 2, 3]);

        await run(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(address, (entity) =>
              Effect.gen(function* () {
                yield* entity.sessions.attach(first.session);
                yield* entity.sessions.attach(second.session);
              }),
            );
            yield* host.run(address, (entity) =>
              Effect.gen(function* () {
                const sessions = yield* entity.sessions.list;
                yield* Effect.forEach(sessions, (session) => session.send("hello"), {
                  discard: true,
                });
                yield* Effect.forEach(sessions, (session) => session.send(binary), {
                  discard: true,
                });
              }),
            );
          }),
        );

        for (const recorded of [first, second]) {
          expect(recorded.frames).toHaveLength(2);
          expect(recorded.frames[0]).toBe("hello");
          // The frame must arrive as bytes, not as a stringified array or a
          // JSON round trip of one.
          expect(recorded.frames[1]).toBeInstanceOf(Uint8Array);
          expect(Array.from(recorded.frames[1] as Uint8Array)).toEqual([1, 2, 3]);
        }
      });

      it("propagates the close code and reason to the transport", async () => {
        const address = makeDurableEntityAddress("document", "session-close");
        const recorded = recordingSession("s-1");

        await run(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(address, (entity) => entity.sessions.attach(recorded.session));
            yield* host.run(address, (entity) =>
              entity.sessions.list.pipe(
                Effect.flatMap((sessions) =>
                  Effect.forEach(sessions, (session) => session.close(1008, "policy"), {
                    discard: true,
                  }),
                ),
              ),
            );
          }),
        );

        expect(recorded.closes).toEqual([{ code: 1008, reason: "policy" }]);
      });

      it("keeps session attachments readable from a later turn", async () => {
        const address = makeDurableEntityAddress("document", "session-attachment");

        const attachment = await run(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(address, (entity) =>
              Effect.gen(function* () {
                const session = testSession("s-1");
                yield* entity.sessions.attach(session);
                yield* session.setAttachment({ authenticated: true });
              }),
            );
            return yield* host.run(address, (entity) =>
              entity.sessions.list.pipe(
                Effect.flatMap((sessions) => sessions[0]!.getAttachment),
              ),
            );
          }),
        );

        expect(attachment).toEqual({ authenticated: true });
      });

      it("sends on a session while a turn for that address is still running", async () => {
        const address = makeDurableEntityAddress("document", "session-outside-turn");
        const recorded = recordingSession("s-1");
        const events: Array<string> = [];

        await run(
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(address, (entity) => entity.sessions.attach(recorded.session));
            const session = yield* host.run(address, (entity) =>
              entity.sessions.list.pipe(Effect.map((sessions) => sessions[0]!)),
            );
            yield* Effect.all(
              [
                host.run(address, () =>
                  Effect.sleep("200 millis").pipe(
                    Effect.andThen(Effect.sync(() => void events.push("turn:end"))),
                  ),
                ),
                // A held turn must not stall delivery: the session handle is a
                // plain socket reference, not something the entity lock owns.
                Effect.sleep("20 millis").pipe(
                  Effect.andThen(session.send("out-of-band")),
                  Effect.andThen(Effect.sync(() => void events.push("sent"))),
                ),
              ],
              { concurrency: "unbounded" },
            );
          }),
        );

        expect(recorded.frames).toEqual(["out-of-band"]);
        expect(events).toEqual(["sent", "turn:end"]);
      });
    }

    const alarmDispatchLayer = options.supportsAlarmDispatch;
    if (alarmDispatchLayer !== undefined) {
      it("reports an armed alarm as due exactly once and forgets it after delete", async () => {
        // Adapters back this with one shared table, so the addresses have to be
        // unique per run or a previous run's rows would answer the assertion.
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const address = makeDurableEntityAddress("document", `alarm-due-${suffix}`);
        const future = makeDurableEntityAddress("document", `alarm-future-${suffix}`);
        const now = Date.now();

        const [due, afterDelete] = await runWith(
          alarmDispatchLayer(),
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            const control = yield* DurableEntityAlarmControl;
            yield* host.run(address, (entity) => entity.alarm.set(now - 1_000));
            yield* host.run(future, (entity) => entity.alarm.set(now + 600_000));
            const due = yield* control.listDueAlarms(now, 100);
            yield* host.run(address, (entity) => entity.alarm.delete);
            yield* host.run(future, (entity) => entity.alarm.delete);
            const afterDelete = yield* control.listDueAlarms(now, 100);
            return [due, afterDelete] as const;
          }),
        );

        const matching = due.filter((alarm) => alarm.address.id === address.id);
        expect(matching).toEqual([{ address, scheduledTime: now - 1_000 }]);
        // An alarm that has not come due yet must stay invisible to the
        // dispatcher, or it would fire early on every poll.
        expect(due.some((alarm) => alarm.address.id === future.id)).toBe(false);
        expect(afterDelete.some((alarm) => alarm.address.id === address.id)).toBe(false);
      });
    }

    const unownedLayer = options.requiresShardLocality;
    if (unownedLayer !== undefined) {
      it("refuses to attach a session the runner does not own", async () => {
        const address = makeDurableEntityAddress("document", "unowned-attach");

        const failed = await runWith(
          unownedLayer(),
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            const exit = yield* Effect.exit(
              host.run(address, (entity) => entity.sessions.attach(testSession("s-1"))),
            );
            return exit._tag === "Failure";
          }),
        );

        expect(failed).toBe(true);
      });

      it("keeps session reads and removals total on an unowned address", async () => {
        const address = makeDurableEntityAddress("document", "unowned-reads");

        const [sessions, found] = await runWith(
          unownedLayer(),
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(address, (entity) => entity.sessions.remove("s-1"));
            const sessions = yield* host.run(address, (entity) => entity.sessions.list);
            const found = yield* host.run(address, (entity) => entity.sessions.get("s-1"));
            return [sessions, found] as const;
          }),
        );

        expect(sessions).toEqual([]);
        expect(found).toBeUndefined();
      });
    }
  });
};
