import { type CronJob, CronScheduler } from "@voidhash/platform/CronScheduler";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { WorkflowRunner } from "@voidhash/platform/WorkflowRunner";
import * as TestWorkflowRunner from "@voidhash/platform/TestWorkflowRunner";
import { generateId } from "@voidhash/core/utils/generate-id";
import { constant } from "@voidhash/lib/lang";
import { Clock, DateTime, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { makeSelfhostAnalyticsRuntimeLive } from "../src/backend/Analytics.ts";
import { makeSelfhostCronJobs } from "../src/backend/Background.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

const requiredJobNames = constant([
  "AppStoreExpireParkedNotificationsWorkflow",
  "PurchaseLedgerDrainWorkflow",
]);

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
      name: `${job.name}-probe-${generateId("test")}`,
      run: (context) =>
        job.run(context).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              executions += 1;
            }),
          ),
        ),
    };
    const now = yield* Clock.currentTimeMillis;
    yield* scheduler.tick(probe, DateTime.toDateUtc(DateTime.makeUnsafe(now)));
    yield* scheduler.tick(probe, DateTime.toDateUtc(DateTime.makeUnsafe(now + twoDaysMillis)));
    return executions;
  });

describe("self-host scheduled jobs", () => {
  it("registers the required background jobs and executes them through the scheduler", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const testRunner = TestWorkflowRunner.make();

        const outcome = yield* Effect.scoped(
          Effect.gen(function* () {
            const jobs: ReadonlyArray<CronJob<PlatformRuntime | WorkflowRunner>> =
              yield* makeSelfhostCronJobs();
            const registered = jobs.map((job) => job.name);
            const executions: Record<string, number> = {};
            for (const name of requiredJobNames) {
              const job = jobs.find((candidate) => candidate.name === name);
              if (job === undefined) continue;
              executions[name] = yield* runThroughScheduler(job);
            }
            return { executions, registered };
          }).pipe(
            Effect.provide(Layer.succeed(WorkflowRunner, testRunner)),
            Effect.provide(makeSelfhostAnalyticsRuntimeLive(getSelfhostRuntimeConfig())),
          ),
        );

        expect(outcome.registered).toEqual(expect.arrayContaining([...requiredJobNames]));
        for (const name of requiredJobNames) {
          expect(outcome.executions[name]).toBeGreaterThanOrEqual(1);
        }
      }),
    ));
});
