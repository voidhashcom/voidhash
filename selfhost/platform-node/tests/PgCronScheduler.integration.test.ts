import {
  type CronJobContext,
  CronScheduler,
  CronSchedulerError,
} from "@voidhash/platform/CronScheduler";
import { Effect, Layer, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import { PgCronSchedulerLive } from "../src/CronScheduler.ts";
import { NodePlatformRuntimeLive } from "../src/PlatformRuntime.ts";
import type { PgPlatformConfig } from "../src/Postgres.ts";

const config: PgPlatformConfig = {
  host: process.env.PLATFORM_NODE_PG_HOST ?? "127.0.0.1",
  port: Number(process.env.PLATFORM_NODE_PG_PORT ?? "5432"),
  database: process.env.PLATFORM_NODE_PG_DATABASE ?? "voidhash",
  username: process.env.PLATFORM_NODE_PG_USERNAME ?? "voidhash",
  password: Redacted.make(process.env.PLATFORM_NODE_PG_PASSWORD ?? "password"),
};

const schedulerLayer = () => Layer.merge(PgCronSchedulerLive(config), NodePlatformRuntimeLive);
const describePg = process.env.PLATFORM_NODE_PG_TEST === "1" ? describe : describe.skip;

describePg("Postgres cron scheduler", () => {
  it("persists schedule progress and catches up missed slots after restart", async () => {
    const name = `cron-catch-up-${crypto.randomUUID()}`;
    const runs: Array<CronJobContext> = [];
    const job = {
      name,
      expression: "* * * * *",
      timeZone: "UTC",
      run: (context: CronJobContext) =>
        Effect.sync(() => {
          runs.push(context);
        }),
    };
    const initialTime = new Date("2026-07-10T12:00:30.000Z");

    const initialized = await Effect.runPromise(
      Effect.gen(function* () {
        const scheduler = yield* CronScheduler;
        return yield* scheduler.tick(job, initialTime);
      }).pipe(Effect.provide(schedulerLayer())),
    );
    expect(initialized).toBe(false);

    const first = await Effect.runPromise(
      Effect.gen(function* () {
        const scheduler = yield* CronScheduler;
        return yield* scheduler.tick(job, new Date("2026-07-10T12:01:00.000Z"));
      }).pipe(Effect.provide(schedulerLayer())),
    );
    expect(first).toBe(true);

    const catchUp = await Effect.runPromise(
      Effect.gen(function* () {
        const scheduler = yield* CronScheduler;
        return yield* Effect.all([
          scheduler.tick(job, new Date("2026-07-10T12:03:30.000Z")),
          scheduler.tick(job, new Date("2026-07-10T12:03:30.000Z")),
          scheduler.tick(job, new Date("2026-07-10T12:03:30.000Z")),
        ]);
      }).pipe(Effect.provide(schedulerLayer())),
    );

    expect(catchUp).toEqual([true, true, false]);
    expect(runs).toEqual([
      { scheduledTime: new Date("2026-07-10T12:01:00.000Z"), catchUp: false },
      { scheduledTime: new Date("2026-07-10T12:02:00.000Z"), catchUp: true },
      { scheduledTime: new Date("2026-07-10T12:03:00.000Z"), catchUp: true },
    ]);
  });

  it("leases one schedule slot across concurrent ticks", async () => {
    const name = `cron-concurrent-${crypto.randomUUID()}`;
    let runCount = 0;
    const job = {
      name,
      expression: "* * * * *",
      timeZone: "UTC",
      run: () =>
        Effect.sync(() => {
          runCount += 1;
        }).pipe(Effect.andThen(Effect.sleep("30 millis"))),
    };

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const scheduler = yield* CronScheduler;
        yield* scheduler.tick(job, new Date("2026-07-10T12:00:30.000Z"));
        return yield* Effect.all(
          [
            scheduler.tick(job, new Date("2026-07-10T12:01:00.000Z")),
            scheduler.tick(job, new Date("2026-07-10T12:01:00.000Z")),
          ],
          { concurrency: "unbounded" },
        );
      }).pipe(Effect.provide(schedulerLayer())),
    );

    expect([...result].sort()).toEqual([false, true]);
    expect(runCount).toBe(1);
  });

  it("releases a failed slot so the same scheduled run can retry", async () => {
    const name = `cron-retry-${crypto.randomUUID()}`;
    const initialTime = new Date("2026-07-10T12:00:30.000Z");
    const dueTime = new Date("2026-07-10T12:01:00.000Z");

    const failure = await Effect.runPromise(
      Effect.gen(function* () {
        const scheduler = yield* CronScheduler;
        const failingJob = {
          name,
          expression: "* * * * *",
          timeZone: "UTC",
          run: () => Effect.fail("job failed"),
        };
        yield* scheduler.tick(failingJob, initialTime);
        return yield* scheduler.tick(failingJob, dueTime).pipe(Effect.flip);
      }).pipe(Effect.provide(schedulerLayer())),
    );

    expect(failure).toBeInstanceOf(CronSchedulerError);
    expect(failure.operation).toBe("run");

    const retried: Array<Date> = [];
    const success = await Effect.runPromise(
      Effect.gen(function* () {
        const scheduler = yield* CronScheduler;
        return yield* scheduler.tick(
          {
            name,
            expression: "* * * * *",
            timeZone: "UTC",
            run: ({ scheduledTime }) =>
              Effect.sync(() => {
                retried.push(scheduledTime);
              }),
          },
          dueTime,
        );
      }).pipe(Effect.provide(schedulerLayer())),
    );

    expect(success).toBe(true);
    expect(retried).toEqual([dueTime]);
  });

  it("rejects an invalid expression through the stable error channel", async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const scheduler = yield* CronScheduler;
        return yield* scheduler
          .tick({
            name: `cron-invalid-${crypto.randomUUID()}`,
            expression: "not a cron",
            run: () => Effect.void,
          })
          .pipe(Effect.flip);
      }).pipe(Effect.provide(schedulerLayer())),
    );

    expect(error).toBeInstanceOf(CronSchedulerError);
    expect(error.operation).toBe("parse");
  });

  it("resets future scheduling when a job definition changes", async () => {
    const name = `cron-definition-${crypto.randomUUID()}`;
    const runs: Array<Date> = [];

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const scheduler = yield* CronScheduler;
        yield* scheduler.tick(
          {
            name,
            expression: "* * * * *",
            timeZone: "UTC",
            run: () => Effect.void,
          },
          new Date("2026-07-10T12:00:30.000Z"),
        );
        const oldSlot = yield* scheduler.tick(
          {
            name,
            expression: "0 * * * *",
            timeZone: "UTC",
            run: ({ scheduledTime }) =>
              Effect.sync(() => {
                runs.push(scheduledTime);
              }),
          },
          new Date("2026-07-10T12:01:00.000Z"),
        );
        const newSlot = yield* scheduler.tick(
          {
            name,
            expression: "0 * * * *",
            timeZone: "UTC",
            run: ({ scheduledTime }) =>
              Effect.sync(() => {
                runs.push(scheduledTime);
              }),
          },
          new Date("2026-07-10T13:00:00.000Z"),
        );
        return { oldSlot, newSlot };
      }).pipe(Effect.provide(schedulerLayer())),
    );

    expect(result).toEqual({ oldSlot: false, newSlot: true });
    expect(runs).toEqual([new Date("2026-07-10T13:00:00.000Z")]);
  });
});
