import { Context, Effect, Schema } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";
import type { PrimitiveDefinition } from "./Primitive.ts";

/** Stable failure raised by a scheduled-job driver. */
export class CronSchedulerError extends Schema.TaggedErrorClass<CronSchedulerError>(
  "CronSchedulerError",
)("CronSchedulerError", {
  cause: Schema.String,
  jobName: Schema.String,
  operation: Schema.String,
}) {}

/** Metadata passed to a scheduled job invocation. */
export interface CronJobContext {
  readonly scheduledTime: Date;
  readonly catchUp: boolean;
}

/** A provider-neutral scheduled job definition. */
export interface CronJob<R = never> {
  readonly name: string;
  readonly expression: string;
  readonly timeZone?: string;
  readonly leaseMillis?: number;
  readonly run: (context: CronJobContext) => Effect.Effect<void, unknown, R>;
}

/** Polling policy for a long-running scheduled job. */
export interface CronRunOptions {
  readonly pollIntervalMillis?: number;
}

/** Provider-neutral persisted cron capabilities. */
export interface CronSchedulerShape {
  /** Claims and runs at most one due schedule slot. */
  readonly tick: <R>(
    job: CronJob<R>,
    now?: Date,
  ) => Effect.Effect<boolean, CronSchedulerError, PlatformRuntime | R>;
  /** Polls a job until the enclosing Effect fiber is interrupted. */
  readonly run: <R>(
    job: CronJob<R>,
    options?: CronRunOptions,
  ) => Effect.Effect<never, CronSchedulerError, PlatformRuntime | R>;
}

/** Provider-neutral cron runtime used by application composition roots. */
export class CronScheduler extends Context.Service<CronScheduler, CronSchedulerShape>()(
  "@voidhash/platform/CronScheduler",
) {}

/** Cron-job constructors. */
export const CronJob = {
  /** Defines a provider-neutral cron job while preserving its requirements. */
  define: <R>(job: CronJob<R>): CronJob<R> => job,
};

/**
 * A scheduled job definition with operations bound to the installed runtime.
 *
 * Both the single-node scheduler and cloud cron triggers bind the same
 * definition, so a schedule is declared exactly once.
 */
export interface CronDefinition<Name extends string, R>
  extends CronJob<R>, PrimitiveDefinition<"cron", Name> {
  readonly name: Name;
  /** Claims and executes at most one due schedule slot. */
  readonly tick: (
    now?: Date,
  ) => Effect.Effect<boolean, CronSchedulerError, CronScheduler | PlatformRuntime | R>;
  /** Runs this schedule until its enclosing fiber is interrupted. */
  readonly start: (
    options?: CronRunOptions,
  ) => Effect.Effect<never, CronSchedulerError, CronScheduler | PlatformRuntime | R>;
}

/** Creates a scheduled job definition without selecting a runtime backend. */
export const ScheduledJob = {
  /** Creates a scheduled job definition without selecting a runtime backend. */
  define: <const Name extends string, R>(
    job: CronJob<R> & { readonly name: Name },
  ): CronDefinition<Name, R> => {
    const definition: CronJob<R> & PrimitiveDefinition<"cron", Name> = { ...job, kind: "cron" };
    return {
      ...definition,
      tick: (now) =>
        CronScheduler.pipe(Effect.flatMap((scheduler) => scheduler.tick(definition, now))),
      start: (options) =>
        CronScheduler.pipe(Effect.flatMap((scheduler) => scheduler.run(definition, options))),
    };
  },
};
