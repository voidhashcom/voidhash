import { Db } from "@voidhash/db";
import { type CronJob, CronScheduler } from "@voidhash/platform/CronScheduler";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeSelfhostAnalyticsRuntimeLive } from "../src/backend/Analytics.ts";
import { makeSelfhostCronJobs } from "../src/backend/Background.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

const requiredJobNames = [
  "app-store-expire-parked-notifications",
  "purchase-ledger-drain",
] as const;

const twoDaysMillis = 2 * 24 * 60 * 60 * 1000;

/**
 * Drives a job through the {@link CronScheduler} port and reports how many times
 * its body executed.
 *
 * The job runs under a probe name so the slot state the adapter persists cannot
 * collide with the schedule a running deployment owns. Both adapters arm an
 * unseen slot on first sight rather than firing it, so the first tick arms and
 * the second one — far enough ahead that every enabled expression is due —
 * claims and runs it.
 *
 * The probe name is unique per run because both adapters persist slot progress
 * durably. Reusing one name would let the first run's recorded position survive:
 * every later run ticks at or behind it, nothing is ever due again, and the test
 * would pass exactly once per database and fail from then on.
 */
const runThroughScheduler = <R>(job: CronJob<R>) =>
  Effect.gen(function* () {
    const scheduler = yield* CronScheduler;
    let executions = 0;
    const probe: CronJob<R> = {
      ...job,
      name: `${job.name}-probe-${crypto.randomUUID()}`,
      run: (context) =>
        job.run(context).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              executions += 1;
            }),
          ),
        ),
    };
    const now = Date.now();
    yield* scheduler.tick(probe, new Date(now));
    yield* scheduler.tick(probe, new Date(now + twoDaysMillis));
    return executions;
  });

describe("self-host scheduled jobs", () => {
  it("registers the required background jobs and executes them through the scheduler", async () => {
    const config = getSelfhostRuntimeConfig();

    const outcome = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const jobs: ReadonlyArray<CronJob<PlatformRuntime | Db>> =
            yield* makeSelfhostCronJobs(config);
          const registered = jobs.map((job) => job.name);
          const executions: Record<string, number> = {};
          for (const name of requiredJobNames) {
            const job = jobs.find((candidate) => candidate.name === name);
            if (job === undefined) continue;
            executions[name] = yield* runThroughScheduler(job);
          }
          return { executions, registered };
        }).pipe(
          Effect.provide(Db.layer(config.database)),
          Effect.provide(makeSelfhostAnalyticsRuntimeLive(config)),
        ),
      ),
    );

    expect(outcome.registered).toEqual(expect.arrayContaining([...requiredJobNames]));
    for (const name of requiredJobNames) {
      expect(outcome.executions[name]).toBeGreaterThanOrEqual(1);
    }
  });
});
