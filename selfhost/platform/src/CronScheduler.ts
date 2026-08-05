import {
  type CronJob,
  type CronRunOptions,
  CronScheduler,
  CronSchedulerError,
  type CronSchedulerShape,
} from "@voidhash/platform/CronScheduler";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Cause, Cron, Effect, Layer, Result, Semaphore } from "effect";
import { ClusterCron, Sharding } from "effect/unstable/cluster";
import { KeyValueStore } from "effect/unstable/persistence";

interface SlotState {
  readonly lastScheduledAtMs: number | undefined;
  readonly nextScheduledAtMs: number;
}

const schedulerError = (jobName: string, operation: string, cause: unknown) =>
  new CronSchedulerError({ jobName, operation, cause: String(cause) });

const parseCron = (job: CronJob<never>) => {
  const parsed = Cron.parse(job.expression, job.timeZone);
  return Result.isSuccess(parsed)
    ? Effect.succeed(parsed.success)
    : Effect.fail(schedulerError(job.name, "parse", parsed.failure.message));
};

const stateKey = (jobName: string): string => `voidhash/platform-selfhost/cron/${jobName}`;

const decodeState = (raw: string | undefined): SlotState | undefined => {
  if (raw === undefined) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<SlotState>;
    return typeof parsed.nextScheduledAtMs === "number"
      ? {
          lastScheduledAtMs:
            typeof parsed.lastScheduledAtMs === "number" ? parsed.lastScheduledAtMs : undefined,
          nextScheduledAtMs: parsed.nextScheduledAtMs,
        }
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Claims and runs at most one due slot.
 *
 * Slot bookkeeping lives in the persistence key-value store, and a local
 * semaphore serializes concurrent ticks for one job inside this process.
 * Cluster-wide exactly-once execution is the job of the `run` operation, which
 * delegates to `ClusterCron`; `tick` is the single-shot affordance used by
 * tests and by runtimes that drive schedules from an external trigger.
 */
const makeTick =
  (store: KeyValueStore.KeyValueStore, locks: Map<string, Semaphore.Semaphore>) =>
  <R>(
    job: CronJob<R>,
    inputNow?: Date,
  ): Effect.Effect<boolean, CronSchedulerError, PlatformRuntime | R> => {
    const lockFor = (name: string): Semaphore.Semaphore => {
      let lock = locks.get(name);
      if (!lock) {
        lock = Semaphore.makeUnsafe(1);
        locks.set(name, lock);
      }
      return lock;
    };

    return PlatformRuntime.pipe(
      Effect.andThen(parseCron(job as unknown as CronJob<never>)),
      Effect.flatMap((cron) =>
        lockFor(job.name).withPermit(
          Effect.gen(function* () {
            const now = inputNow?.getTime() ?? Date.now();
            const key = stateKey(job.name);
            const stored = yield* store
              .get(key)
              .pipe(Effect.mapError((cause) => schedulerError(job.name, "claim", cause)));
            const state = decodeState(stored);

            // First sight of a job arms it for its next occurrence: a fresh
            // deployment must not immediately fire every schedule it has never
            // run before.
            if (state === undefined) {
              const armed: SlotState = {
                lastScheduledAtMs: undefined,
                nextScheduledAtMs: Cron.next(cron, new Date(now)).getTime(),
              };
              yield* store
                .set(key, JSON.stringify(armed))
                .pipe(Effect.mapError((cause) => schedulerError(job.name, "claim", cause)));
              return false;
            }

            if (state.nextScheduledAtMs > now) return false;

            const scheduledTime = state.nextScheduledAtMs;
            const nextScheduledAtMs = Cron.next(cron, new Date(scheduledTime)).getTime();

            yield* job
              .run({ scheduledTime: new Date(scheduledTime), catchUp: scheduledTime < now })
              .pipe(
                Effect.catchCause((cause) =>
                  Effect.fail(schedulerError(job.name, "run", Cause.pretty(cause))),
                ),
              );

            yield* store
              .set(
                key,
                JSON.stringify({
                  lastScheduledAtMs: scheduledTime,
                  nextScheduledAtMs,
                } satisfies SlotState),
              )
              .pipe(Effect.mapError((cause) => schedulerError(job.name, "complete", cause)));

            return true;
          }),
        ),
      ),
    ) as Effect.Effect<boolean, CronSchedulerError, PlatformRuntime | R>;
  };

/**
 * Runs a schedule until interrupted, using `ClusterCron` so exactly one runner
 * in the cluster executes each slot even when several are alive.
 *
 * Each job becomes its own entity type, `ClusterCron/<name>`, and its due slots
 * are durable rows in `cluster_messages`. A row addressed to a job no process
 * registers is never discarded: the storage read loop retries it in a tight
 * loop ("Could not find entity manager for address, retrying") and starves the
 * runner, stalling unrelated workflows and queue consumers. Renaming or
 * removing a job therefore requires draining its messages by hand — see
 * "Renaming or removing a cron job" in selfhost/README.md.
 */
const makeRun =
  (sharding: Sharding.Sharding["Service"]) =>
  <R>(
    job: CronJob<R>,
    _options?: CronRunOptions,
  ): Effect.Effect<never, CronSchedulerError, PlatformRuntime | R> =>
    PlatformRuntime.pipe(
      Effect.andThen(parseCron(job as unknown as CronJob<never>)),
      Effect.flatMap((cron) =>
        Layer.launch(
          ClusterCron.make({
            name: job.name,
            cron,
            execute: Effect.suspend(() =>
              job.run({ scheduledTime: new Date(), catchUp: false }),
            ).pipe(
              Effect.catchCause((cause) =>
                Effect.logError("scheduled job failed", {
                  jobName: job.name,
                  cause: Cause.pretty(cause),
                }),
              ),
            ),
          }),
        ).pipe(Effect.provideService(Sharding.Sharding, sharding)),
      ),
    ) as Effect.Effect<never, CronSchedulerError, PlatformRuntime | R>;

const makeScheduler = (
  store: KeyValueStore.KeyValueStore,
  sharding: Sharding.Sharding["Service"],
): CronSchedulerShape =>
  ({
    tick: makeTick(store, new Map<string, Semaphore.Semaphore>()),
    run: makeRun(sharding),
  }) as CronSchedulerShape;

/** Cluster-backed cron scheduler with durable slot state. */
export const ClusterCronSchedulerLive: Layer.Layer<
  CronScheduler,
  never,
  Sharding.Sharding | KeyValueStore.KeyValueStore
> = Layer.effect(
  CronScheduler,
  Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore;
    const sharding = yield* Sharding.Sharding;
    return makeScheduler(store, sharding);
  }),
);
