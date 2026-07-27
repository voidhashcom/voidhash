import { makeDurableEntityAddress, type DurableEntitySession } from "@voidhash/platform/DurableEntity";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";

import { makeMemoryDurableEntityHost } from "../src/core/local-entity-host.ts";

describe("memory DurableEntity host", () => {
  test("serializes operations for the same address in submission order", async () => {
    const host = makeMemoryDurableEntityHost();
    const address = makeDurableEntityAddress("document", "one");
    const events: Array<string> = [];
    let active = 0;
    let overlap = false;

    const operation = (name: string) =>
      host.run(address, () =>
        Effect.gen(function* () {
          active += 1;
          overlap ||= active > 1;
          events.push(`${name}:start`);
          yield* Effect.sleep("20 millis");
          events.push(`${name}:end`);
          active -= 1;
        }),
      );

    await Effect.runPromise(
      Effect.all([operation("first"), operation("second")], { concurrency: "unbounded" }),
    );

    expect(overlap).toBe(false);
    expect(events).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });

  test("allows different entity addresses to run concurrently", async () => {
    const host = makeMemoryDurableEntityHost();
    let active = 0;
    let maxActive = 0;

    const operation = (id: string) =>
      host.run(makeDurableEntityAddress("document", id), () =>
        Effect.gen(function* () {
          active += 1;
          maxActive = Math.max(maxActive, active);
          yield* Effect.sleep("20 millis");
          active -= 1;
        }),
      );

    await Effect.runPromise(
      Effect.all([operation("one"), operation("two")], { concurrency: "unbounded" }),
    );

    expect(maxActive).toBe(2);
  });

  test("retains entity-local key-value, alarm, and session state", async () => {
    const host = makeMemoryDurableEntityHost();
    const address = makeDurableEntityAddress("document", "one");
    let attachment: unknown;
    const session: DurableEntitySession = {
      id: "session-1",
      send: () => Effect.void,
      close: () => Effect.void,
      getAttachment: Effect.sync(() => attachment),
      setAttachment: (value) => Effect.sync(() => void (attachment = value)),
    };

    await Effect.runPromise(
      host.run(address, (entity) =>
        Effect.gen(function* () {
          yield* entity.keyValue.put("seq", 7);
          yield* entity.alarm.set(1234);
          yield* entity.sessions.attach(session);
        }),
      ),
    );

    const state = await Effect.runPromise(
      host.run(address, (entity) =>
        Effect.all({
          seq: entity.keyValue.get("seq"),
          alarm: entity.alarm.get,
          sessions: entity.sessions.list,
        }),
      ),
    );

    expect(state.seq).toBe(7);
    expect(state.alarm).toBe(1234);
    expect(state.sessions.map(({ id }) => id)).toEqual(["session-1"]);
  });
});
