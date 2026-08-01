import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import {
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
}

const testSession = (id: string): DurableEntitySession => ({
  id,
  send: () => Effect.void,
  close: () => Effect.void,
  getAttachment: Effect.succeed(undefined),
  setAttachment: () => Effect.void,
});

/**
 * Behaviour every durable entity host must exhibit: operations on one address
 * run one at a time, different addresses make progress independently, and
 * entity-local state outlives the operation that wrote it.
 */
export const durableEntityHostConformance = (
  options: DurableEntityConformanceOptions,
): void => {
  const run = <A, E>(effect: Effect.Effect<A, E, DurableEntityHost>): Promise<A> =>
    Effect.runPromise(
      Effect.scoped(effect.pipe(Effect.provide(options.layer()))) as Effect.Effect<A, E>,
    );

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
    }
  });
};
