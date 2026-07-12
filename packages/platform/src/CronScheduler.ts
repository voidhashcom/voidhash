import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { PlatformRuntime } from "./PlatformRuntime.ts";

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
