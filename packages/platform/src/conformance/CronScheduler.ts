import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { CronScheduler, type CronJobContext } from "../CronScheduler.ts";
import type { PlatformRuntime } from "../PlatformRuntime.ts";

/** Wiring one adapter must supply for the cron conformance suite. */
export interface CronConformanceOptions {
  readonly name: string;
  /** Builds an isolated scheduler; called once per test so slots never leak. */
  readonly layer: () => Layer.Layer<CronScheduler | PlatformRuntime>;
}

const MINUTELY = "* * * * *";

/**
 * Behaviour every cron scheduler must exhibit.
 *
 * `tick` is the unit of the contract: it claims at most one due slot, reports
 * whether it ran one, and never replays a slot it has already completed. A
 * schedule seen for the first time is armed rather than fired, so deploying a
 * new job does not immediately execute it.
 */
export const cronSchedulerConformance = (options: CronConformanceOptions): void => {
  const run = <A, E>(
    effect: Effect.Effect<A, E, CronScheduler | PlatformRuntime>,
  ): Promise<A> =>
    Effect.runPromise(
      Effect.scoped(effect.pipe(Effect.provide(options.layer()))) as Effect.Effect<A, E>,
    );

  const job = (name: string, contexts: Array<CronJobContext>) => ({
    name,
    expression: MINUTELY,
    run: (context: CronJobContext) => Effect.sync(() => void contexts.push(context)),
  });

  describe(`${options.name}: cron scheduler conformance`, () => {
    it("arms a newly seen schedule without running it", async () => {
      const contexts: Array<CronJobContext> = [];

      const ran = await run(
        Effect.gen(function* () {
          const scheduler = yield* CronScheduler;
          return yield* scheduler.tick(job("conformance-arm", contexts), new Date());
        }),
      );

      expect(ran).toBe(false);
      expect(contexts).toEqual([]);
    });

    it("runs a due slot exactly once", async () => {
      const contexts: Array<CronJobContext> = [];
      const start = new Date("2026-01-01T00:00:30.000Z");
      // One minute later the armed slot is due; the slot after it is not.
      const later = new Date("2026-01-01T00:01:30.000Z");

      const [armed, due, repeated] = await run(
        Effect.gen(function* () {
          const scheduler = yield* CronScheduler;
          const definition = job("conformance-slot", contexts);
          const armed = yield* scheduler.tick(definition, start);
          const due = yield* scheduler.tick(definition, later);
          const repeated = yield* scheduler.tick(definition, later);
          return [armed, due, repeated] as const;
        }),
      );

      expect(armed).toBe(false);
      expect(due).toBe(true);
      // The slot already ran, and the following slot is not yet due.
      expect(repeated).toBe(false);
      expect(contexts).toHaveLength(1);
    });

    it("marks a late slot as a catch-up run", async () => {
      const contexts: Array<CronJobContext> = [];
      const start = new Date("2026-01-01T00:00:30.000Z");
      const late = new Date("2026-01-01T01:00:30.000Z");

      await run(
        Effect.gen(function* () {
          const scheduler = yield* CronScheduler;
          const definition = job("conformance-catchup", contexts);
          yield* scheduler.tick(definition, start);
          yield* scheduler.tick(definition, late);
        }),
      );

      expect(contexts).toHaveLength(1);
      expect(contexts[0]?.catchUp).toBe(true);
      // The slot reported is the one that was due, not the current time.
      expect(contexts[0]?.scheduledTime.getTime()).toBeLessThan(late.getTime());
    });

    it("surfaces a failing job as a scheduler error", async () => {
      const start = new Date("2026-01-01T00:00:30.000Z");
      const later = new Date("2026-01-01T00:01:30.000Z");

      const exit = await run(
        Effect.gen(function* () {
          const scheduler = yield* CronScheduler;
          const definition = {
            name: "conformance-failure",
            expression: MINUTELY,
            run: () => Effect.fail("boom"),
          };
          yield* scheduler.tick(definition, start);
          return yield* Effect.exit(scheduler.tick(definition, later));
        }),
      );

      expect(exit._tag).toBe("Failure");
    });
  });
};
