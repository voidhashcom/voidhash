import { makeDurableEntityAddress } from "@voidhash/platform/DurableEntity";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeMemoryDurableEntityHost } from "../src/MemoryDurableEntity.ts";

describe("memory durable entity host", () => {
  it("serializes one address while allowing different addresses to overlap", async () => {
    const host = makeMemoryDurableEntityHost();
    const first = makeDurableEntityAddress("document", "first");
    const second = makeDurableEntityAddress("document", "second");
    const events: string[] = [];

    await Effect.runPromise(
      Effect.all(
        [
          host.run(first, () =>
            Effect.gen(function* () {
              events.push("first:start");
              yield* Effect.sleep("30 millis");
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
      ),
    );

    expect(events.indexOf("second:end")).toBeLessThan(events.indexOf("first:end"));
    expect(events.indexOf("first:end")).toBeLessThan(events.indexOf("first:next"));
  });

  it("retains entity-local KV, alarm, and session state", async () => {
    const host = makeMemoryDurableEntityHost();
    const address = makeDurableEntityAddress("document", "stateful");
    const session = {
      id: "session-1",
      send: () => Effect.void,
      close: () => Effect.void,
      getAttachment: Effect.succeed(undefined),
      setAttachment: () => Effect.void,
    };

    await Effect.runPromise(
      host.run(address, (entity) =>
        Effect.gen(function* () {
          yield* entity.keyValue.put("value", { count: 1 });
          yield* entity.alarm.set(1234);
          yield* entity.sessions.attach(session);
        }),
      ),
    );

    const state = await Effect.runPromise(
      host.run(address, (entity) =>
        Effect.all({
          value: entity.keyValue.get("value"),
          alarm: entity.alarm.get,
          sessions: entity.sessions.list,
        }),
      ),
    );
    expect(state).toEqual({ value: { count: 1 }, alarm: 1234, sessions: [session] });
  });
});
