import {
  DurableEntityHost,
  makeDurableEntityAddress,
} from "@voidhash/platform/DurableEntity";
import { Effect, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import {
  NodeDurableEntityControl,
  PgDurableEntityHostLive,
  type PgDurableEntityConfig,
} from "../src/DurableEntity.ts";

const config: PgDurableEntityConfig = {
  host: process.env.PLATFORM_NODE_PG_HOST ?? "127.0.0.1",
  port: Number(process.env.PLATFORM_NODE_PG_PORT ?? "5432"),
  database: process.env.PLATFORM_NODE_PG_DATABASE ?? "voidhash",
  username: process.env.PLATFORM_NODE_PG_USERNAME ?? "voidhash",
  password: Redacted.make(process.env.PLATFORM_NODE_PG_PASSWORD ?? "password"),
};

const describePg = process.env.PLATFORM_NODE_PG_TEST === "1" ? describe : describe.skip;

describePg("Postgres durable entity host", () => {
  it("boots concurrent host layers without racing the schema migration", async () => {
    const addresses = [
      makeDurableEntityAddress("integration", crypto.randomUUID()),
      makeDurableEntityAddress("integration", crypto.randomUUID()),
    ] as const;

    await Effect.runPromise(
      Effect.all(
        addresses.map((address) =>
          Effect.gen(function* () {
            const host = yield* DurableEntityHost;
            yield* host.run(address, (entity) => entity.keyValue.put("booted", true));
          }).pipe(Effect.provide(PgDurableEntityHostLive(config))),
        ),
        { concurrency: "unbounded" },
      ),
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const host = yield* DurableEntityHost;
        yield* Effect.forEach(
          addresses,
          (address) => host.run(address, (entity) => entity.keyValue.delete("booted")),
          { discard: true },
        );
      }).pipe(Effect.provide(PgDurableEntityHostLive(config))),
    );
  });

  it("persists KV, entity-local SQL, and alarms across layer restarts", async () => {
    const address = makeDurableEntityAddress("integration", crypto.randomUUID());
    const otherAddress = makeDurableEntityAddress("integration", crypto.randomUUID());
    const scheduledTime = Date.now() - 1;

    await Effect.runPromise(
      Effect.gen(function* () {
        const host = yield* DurableEntityHost;
        yield* host.run(address, (entity) =>
          Effect.gen(function* () {
            yield* entity.keyValue.put("profile", { name: "node" });
            yield* entity.keyValue.put("label", "node-string");
            yield* entity.alarm.set(scheduledTime);
            yield* entity.sql!.execute("CREATE TABLE counter (value INTEGER NOT NULL)");
            yield* entity.sql!.execute("INSERT INTO counter (value) VALUES ($1)", [7]);
          }),
        );
        yield* host.run(otherAddress, (entity) =>
          Effect.gen(function* () {
            yield* entity.sql!.execute("CREATE TABLE counter (value INTEGER NOT NULL)");
            yield* entity.sql!.execute("INSERT INTO counter (value) VALUES ($1)", [9]);
          }),
        );
      }).pipe(Effect.provide(PgDurableEntityHostLive(config))),
    );

    const restored = await Effect.runPromise(
      Effect.gen(function* () {
        const host = yield* DurableEntityHost;
        const control = yield* NodeDurableEntityControl;
        const state = yield* host.run(address, (entity) =>
          Effect.all({
            profile: entity.keyValue.get("profile"),
            label: entity.keyValue.get("label"),
            alarm: entity.alarm.get,
            rows: entity.sql!.execute<{ readonly value: number }>(
              "SELECT value FROM counter",
            ),
          }),
        );
        const otherRows = yield* host.run(otherAddress, (entity) =>
          entity.sql!.execute<{ readonly value: number }>("SELECT value FROM counter"),
        );
        const due = yield* control.listDueAlarms(Date.now(), 100);
        return { state, otherRows, due };
      }).pipe(Effect.provide(PgDurableEntityHostLive(config))),
    );

    expect(restored.state).toEqual({
      profile: { name: "node" },
      label: "node-string",
      alarm: scheduledTime,
      rows: [{ value: 7 }],
    });
    expect(restored.otherRows).toEqual([{ value: 9 }]);
    expect(restored.due).toContainEqual({ address, scheduledTime });

    await Effect.runPromise(
      Effect.gen(function* () {
        const host = yield* DurableEntityHost;
        yield* host.run(address, (entity) =>
          Effect.gen(function* () {
            yield* entity.keyValue.delete("profile");
            yield* entity.keyValue.delete("label");
            yield* entity.alarm.delete;
            yield* entity.sql!.execute("DROP TABLE counter");
          }),
        );
        yield* host.run(otherAddress, (entity) => entity.sql!.execute("DROP TABLE counter"));
      }).pipe(Effect.provide(PgDurableEntityHostLive(config))),
    );
  });
});
