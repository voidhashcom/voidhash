import {
  type CronJob,
  type CronRunOptions,
  CronScheduler,
  CronSchedulerError,
  type CronSchedulerShape,
} from "@orbian/sdk/CronScheduler";
import { PlatformRuntime } from "@orbian/sdk/PlatformRuntime";
import { Cause, Cron, Duration, Effect, Layer, Result } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { PgPlatformClientLive, type PgPlatformConfig } from "./Postgres.js";

interface ClaimedRunRow {
  readonly leaseToken: string;
  readonly scheduledTime: number | string;
}

interface ChangedRow {
  readonly jobName: string;
}

const ensureTable = (sql: SqlClient.SqlClient) =>
  sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`SELECT pg_advisory_xact_lock(hashtext('orbian_cron_schema_v1'))`;
      yield* sql`
        CREATE TABLE IF NOT EXISTS platform_cron_state (
          job_name TEXT PRIMARY KEY,
          expression TEXT NOT NULL,
          time_zone TEXT,
          last_scheduled_at_ms BIGINT,
          next_scheduled_at_ms BIGINT NOT NULL,
          lease_token TEXT,
          leased_until_ms BIGINT,
          updated_at_ms BIGINT NOT NULL
        )
      `;
      yield* sql`
        CREATE INDEX IF NOT EXISTS platform_cron_state_due_idx
        ON platform_cron_state (next_scheduled_at_ms)
      `;
    }),
  );

const schedulerError = (jobName: string, operation: string, cause: unknown) =>
  new CronSchedulerError({ jobName, operation, cause: String(cause) });

const parseCron = (job: CronJob<unknown>) => {
  const parsed = Cron.parse(job.expression, job.timeZone);
  return Result.isSuccess(parsed)
    ? Effect.succeed(parsed.success)
    : Effect.fail(schedulerError(job.name, "parse", parsed.failure.message));
};

const leaseMillis = (job: CronJob<unknown>): number => {
  const value = job.leaseMillis;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 300_000;
};

const claimRun = (
  sql: SqlClient.SqlClient,
  job: CronJob<unknown>,
  cron: Cron.Cron,
  now: number,
) => {
  const initialNext = Cron.next(cron, new Date(now - 1)).getTime();
  const token = crypto.randomUUID();
  const timeZone = job.timeZone ?? null;
  return sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`
        INSERT INTO platform_cron_state (
          job_name, expression, time_zone, next_scheduled_at_ms, updated_at_ms
        ) VALUES (
          ${job.name}, ${job.expression}, ${timeZone}, ${initialNext}, ${now}
        )
        ON CONFLICT (job_name)
        DO UPDATE SET
          next_scheduled_at_ms = EXCLUDED.next_scheduled_at_ms,
          expression = EXCLUDED.expression,
          time_zone = EXCLUDED.time_zone,
          lease_token = NULL,
          leased_until_ms = NULL,
          updated_at_ms = EXCLUDED.updated_at_ms
        WHERE platform_cron_state.expression IS DISTINCT FROM EXCLUDED.expression
          OR platform_cron_state.time_zone IS DISTINCT FROM EXCLUDED.time_zone
      `;
      return yield* sql<ClaimedRunRow>`
        WITH candidate AS (
          SELECT job_name
          FROM platform_cron_state
          WHERE job_name = ${job.name}
            AND next_scheduled_at_ms <= ${now}
            AND (leased_until_ms IS NULL OR leased_until_ms <= ${now})
          FOR UPDATE SKIP LOCKED
        )
        UPDATE platform_cron_state AS state
        SET lease_token = ${token},
            leased_until_ms = ${now + leaseMillis(job)},
            updated_at_ms = ${now}
        FROM candidate
        WHERE state.job_name = candidate.job_name
        RETURNING state.next_scheduled_at_ms AS "scheduledTime", state.lease_token AS "leaseToken"
      `;
    }),
  );
};

const releaseRun = (sql: SqlClient.SqlClient, jobName: string, leaseToken: string, now: number) =>
  sql`
    UPDATE platform_cron_state
    SET lease_token = NULL, leased_until_ms = NULL, updated_at_ms = ${now}
    WHERE job_name = ${jobName} AND lease_token = ${leaseToken}
  `;

const completeRun = (
  sql: SqlClient.SqlClient,
  jobName: string,
  leaseToken: string,
  scheduledTime: number,
  nextScheduledTime: number,
  now: number,
) =>
  sql<ChangedRow>`
    UPDATE platform_cron_state
    SET last_scheduled_at_ms = ${scheduledTime},
        next_scheduled_at_ms = ${nextScheduledTime},
        lease_token = NULL,
        leased_until_ms = NULL,
        updated_at_ms = ${now}
    WHERE job_name = ${jobName} AND lease_token = ${leaseToken}
    RETURNING job_name AS "jobName"
  `;

const tick = <R>(
  sql: SqlClient.SqlClient,
  job: CronJob<R>,
  inputNow: Date | undefined,
): Effect.Effect<boolean, CronSchedulerError, PlatformRuntime | R> =>
  PlatformRuntime.pipe(
    Effect.andThen(parseCron(job)),
    Effect.flatMap((cron) =>
      Effect.suspend(() => {
        const now = inputNow?.getTime() ?? Date.now();
        return claimRun(sql, job, cron, now).pipe(
          Effect.mapError((cause) => schedulerError(job.name, "claim", cause)),
          Effect.flatMap((rows) => {
            const claimed = rows[0];
            if (!claimed) return Effect.succeed(false);
            const scheduledTime = Number(claimed.scheduledTime);
            const nextScheduledTime = Cron.next(cron, new Date(scheduledTime)).getTime();
            return job
              .run({
                scheduledTime: new Date(scheduledTime),
                catchUp: scheduledTime < now,
              })
              .pipe(
                Effect.matchCauseEffect({
                  onFailure: (cause) =>
                    releaseRun(sql, job.name, claimed.leaseToken, Date.now()).pipe(
                      Effect.mapError((releaseCause) =>
                        schedulerError(job.name, "release", releaseCause),
                      ),
                      Effect.andThen(
                        Effect.fail(schedulerError(job.name, "run", Cause.pretty(cause))),
                      ),
                    ),
                  onSuccess: () =>
                    completeRun(
                      sql,
                      job.name,
                      claimed.leaseToken,
                      scheduledTime,
                      nextScheduledTime,
                      Date.now(),
                    ).pipe(
                      Effect.flatMap((changed) =>
                        changed.length === 1
                          ? Effect.succeed(true)
                          : Effect.fail(
                              schedulerError(
                                job.name,
                                "complete",
                                "cron lease expired before completion",
                              ),
                            ),
                      ),
                      Effect.mapError((cause) =>
                        cause instanceof CronSchedulerError
                          ? cause
                          : schedulerError(job.name, "complete", cause),
                      ),
                    ),
                }),
              );
          }),
        );
      }),
    ),
  );

const makeScheduler = (sql: SqlClient.SqlClient): CronSchedulerShape => ({
  tick: (job, now) => tick(sql, job, now),
  run: (job, options: CronRunOptions = {}) => {
    const pollInterval =
      typeof options.pollIntervalMillis === "number" &&
      Number.isFinite(options.pollIntervalMillis) &&
      options.pollIntervalMillis > 0
        ? Math.floor(options.pollIntervalMillis)
        : 1_000;
    return Effect.forever(
      tick(sql, job, undefined).pipe(
        Effect.catch((error) =>
          Effect.logError("scheduled job tick failed", {
            jobName: job.name,
            operation: error.operation,
            cause: error.cause,
          }).pipe(Effect.as(false)),
        ),
        Effect.flatMap((ran) =>
          ran ? Effect.yieldNow : Effect.sleep(Duration.millis(pollInterval)),
        ),
      ),
    );
  },
});

/** Postgres-backed cron scheduler with persisted catch-up and execution leases. */
export const PgCronSchedulerLive = (config: PgPlatformConfig): Layer.Layer<CronScheduler> =>
  Layer.effect(
    CronScheduler,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* ensureTable(sql);
      return makeScheduler(sql);
    }),
  ).pipe(Layer.provide(PgPlatformClientLive(config)), Layer.orDie);
