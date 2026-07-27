import { Duration, Effect, Exit, Fiber, Layer, Option, Schema, Scope } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { Workflow, WorkflowEngine } from "effect/unstable/workflow";

import { PgPlatformClientLive, type PgPlatformConfig } from "./Postgres.ts";

interface RegisteredWorkflow {
  readonly workflow: Workflow.Any;
  readonly execute: (
    payload: object,
    executionId: string,
  ) => Effect.Effect<unknown, unknown, WorkflowEngine.WorkflowInstance | WorkflowEngine.WorkflowEngine>;
  readonly scope: Scope.Scope;
}

interface ClaimedExecutionRow {
  readonly executionId: string;
  readonly interrupted: boolean;
  readonly leaseToken: string;
  readonly parentExecutionId: string | null;
  readonly payload: unknown;
  readonly workflowName: string;
}

interface ExecutionResultRow {
  readonly result: unknown;
}

interface ExecutionIdRow {
  readonly executionId: string;
}

interface ActivityResultRow {
  readonly result: unknown;
}

interface DeferredResultRow {
  readonly exit: unknown;
}

interface DueClockRow {
  readonly deferredName: string;
  readonly executionId: string;
  readonly exit: unknown;
  readonly workflowName: string;
}

interface ActiveExecution {
  readonly instance: WorkflowEngine.WorkflowInstance["Service"];
  interrupt: Effect.Effect<void>;
}

const activityResultCodec = Schema.toCodecJson(
  Workflow.Result({ success: Schema.Any, error: Schema.Any }),
);

type JsonCodec = Schema.Codec<unknown, Schema.Json, never>;

const jsonCodec = (schema: Schema.Top): JsonCodec =>
  Schema.toCodecJson(schema) as JsonCodec;

const encodeJson = (value: unknown): Effect.Effect<string, unknown> =>
  Effect.try({
    try: () => {
      const encoded = JSON.stringify(value);
      if (encoded === undefined) throw new TypeError("Workflow state must be JSON-serializable");
      return encoded;
    },
    catch: (cause) => cause,
  });

const ensureTables = (sql: SqlClient.SqlClient) =>
  sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`SELECT pg_advisory_xact_lock(hashtext('voidhash_platform_workflow_schema_v1'))`;
      yield* sql`
        CREATE TABLE IF NOT EXISTS platform_workflow_execution (
          execution_id TEXT PRIMARY KEY,
          workflow_name TEXT NOT NULL,
          payload_json JSONB NOT NULL,
          parent_execution_id TEXT,
          status TEXT NOT NULL,
          result_json JSONB,
          interrupted BOOLEAN NOT NULL DEFAULT FALSE,
          resume_requested BOOLEAN NOT NULL DEFAULT FALSE,
          lease_token TEXT,
          leased_until_ms BIGINT,
          created_at_ms BIGINT NOT NULL,
          updated_at_ms BIGINT NOT NULL
        )
      `;
      yield* sql`
        ALTER TABLE platform_workflow_execution
        ADD COLUMN IF NOT EXISTS resume_requested BOOLEAN NOT NULL DEFAULT FALSE
      `;
      yield* sql`
        CREATE INDEX IF NOT EXISTS platform_workflow_execution_claim_idx
        ON platform_workflow_execution (status, leased_until_ms, updated_at_ms)
      `;
      yield* sql`
        CREATE TABLE IF NOT EXISTS platform_workflow_activity (
          execution_id TEXT NOT NULL,
          activity_name TEXT NOT NULL,
          attempt INTEGER NOT NULL,
          result_json JSONB NOT NULL,
          updated_at_ms BIGINT NOT NULL,
          PRIMARY KEY (execution_id, activity_name, attempt)
        )
      `;
      yield* sql`
        CREATE TABLE IF NOT EXISTS platform_workflow_deferred (
          execution_id TEXT NOT NULL,
          deferred_name TEXT NOT NULL,
          exit_json JSONB NOT NULL,
          updated_at_ms BIGINT NOT NULL,
          PRIMARY KEY (execution_id, deferred_name)
        )
      `;
      yield* sql`
        CREATE TABLE IF NOT EXISTS platform_workflow_clock (
          execution_id TEXT NOT NULL,
          workflow_name TEXT NOT NULL,
          deferred_name TEXT NOT NULL,
          due_at_ms BIGINT NOT NULL,
          exit_json JSONB NOT NULL,
          created_at_ms BIGINT NOT NULL,
          PRIMARY KEY (execution_id, deferred_name)
        )
      `;
      yield* sql`
        CREATE INDEX IF NOT EXISTS platform_workflow_clock_due_idx
        ON platform_workflow_clock (due_at_ms)
      `;
    }),
  );

const workflowResultCodec = (workflow: Workflow.Any) =>
  Schema.toCodecJson(
    Workflow.Result({
      success: workflow.successSchema,
      error: workflow.errorSchema,
    }),
  ) as JsonCodec;

const encodePayload = (workflow: Workflow.Any, payload: object) =>
  Schema.encodeEffect(jsonCodec(workflow.payloadSchema))(payload).pipe(
    Effect.flatMap(encodeJson),
  );

const decodePayload = (workflow: Workflow.Any, payload: unknown) =>
  Schema.decodeEffect(jsonCodec(workflow.payloadSchema))(payload as Schema.Json);

const encodeWorkflowResult = (
  workflow: Workflow.Any,
  result: Workflow.Result<unknown, unknown>,
) => Schema.encodeEffect(workflowResultCodec(workflow))(result).pipe(Effect.flatMap(encodeJson));

const decodeWorkflowResult = (workflow: Workflow.Any, result: unknown) =>
  Schema.decodeEffect(workflowResultCodec(workflow))(result as Schema.Json) as Effect.Effect<
    Workflow.Result<unknown, unknown>
  >;

const encodeActivityResult = (result: Workflow.Result<unknown, unknown>) =>
  Schema.encodeEffect(activityResultCodec)(result).pipe(Effect.flatMap(encodeJson));

const decodeActivityResult = (result: unknown) =>
  Schema.decodeEffect(activityResultCodec)(result as Schema.Json);

const makePgEngine = (sql: SqlClient.SqlClient) =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope;
    const registered = new Map<string, RegisteredWorkflow>();
    const active = new Map<string, ActiveExecution>();
    const leaseMillis = 30_000;

    let engine: WorkflowEngine.WorkflowEngine["Service"];

    const claimExecution = (executionId: string) =>
      Effect.suspend(() => {
        const now = Date.now();
        const token = crypto.randomUUID();
        return sql<ClaimedExecutionRow>`
          WITH candidate AS (
            SELECT execution_id
            FROM platform_workflow_execution
            WHERE execution_id = ${executionId}
              AND status IN ('pending', 'running')
              AND (leased_until_ms IS NULL OR leased_until_ms <= ${now})
            FOR UPDATE SKIP LOCKED
          )
          UPDATE platform_workflow_execution AS execution
          SET status = 'running',
              result_json = NULL,
              resume_requested = FALSE,
              lease_token = ${token},
              leased_until_ms = ${now + leaseMillis},
              updated_at_ms = ${now}
          FROM candidate
          WHERE execution.execution_id = candidate.execution_id
          RETURNING execution.execution_id AS "executionId",
                    execution.workflow_name AS "workflowName",
                    execution.payload_json AS "payload",
                    execution.parent_execution_id AS "parentExecutionId",
                    execution.interrupted,
                    execution.lease_token AS "leaseToken"
        `;
      });

    const releaseUnregistered = (executionId: string, leaseToken: string) =>
      Effect.suspend(() => {
        const now = Date.now();
        return sql`
          UPDATE platform_workflow_execution
          SET status = 'pending', lease_token = NULL, leased_until_ms = NULL, updated_at_ms = ${now}
          WHERE execution_id = ${executionId} AND lease_token = ${leaseToken}
        `;
      });

    const releaseFailedExecution = (executionId: string, leaseToken: string) =>
      Effect.suspend(() => {
        const now = Date.now();
        return sql`
          UPDATE platform_workflow_execution
          SET status = 'pending', lease_token = NULL, leased_until_ms = NULL, updated_at_ms = ${now}
          WHERE execution_id = ${executionId} AND lease_token = ${leaseToken}
        `;
      });

    const persistExecutionResult = (
      row: ClaimedExecutionRow,
      workflow: Workflow.Any,
      result: Workflow.Result<unknown, unknown>,
    ) =>
      Effect.gen(function* () {
        const encoded = yield* encodeWorkflowResult(workflow, result);
        const now = Date.now();
        const suspended = result._tag === "Suspended";
        const changed = yield* sql<ExecutionIdRow>`
          UPDATE platform_workflow_execution
          SET status = CASE
                WHEN ${suspended} AND resume_requested THEN 'pending'
                ELSE ${suspended ? "suspended" : "complete"}
              END,
              result_json = CASE
                WHEN ${suspended} AND resume_requested THEN NULL
                ELSE ${encoded}::jsonb
              END,
              resume_requested = FALSE,
              lease_token = NULL,
              leased_until_ms = NULL,
              updated_at_ms = ${now}
          WHERE execution_id = ${row.executionId} AND lease_token = ${row.leaseToken}
          RETURNING execution_id AS "executionId"
        `;
        return changed.length === 1;
      });

    const heartbeatLease = (row: ClaimedExecutionRow) =>
      Effect.forever(
        Effect.sleep(leaseMillis / 3).pipe(
          Effect.andThen(
            Effect.suspend(() => {
              const now = Date.now();
              return sql`
                UPDATE platform_workflow_execution
                SET leased_until_ms = ${now + leaseMillis}, updated_at_ms = ${now}
                WHERE execution_id = ${row.executionId}
                  AND lease_token = ${row.leaseToken}
                  AND status = 'running'
              `;
            }),
          ),
          Effect.catchCause((cause) =>
            Effect.logError("workflow execution lease heartbeat failed", {
              executionId: row.executionId,
              workflowName: row.workflowName,
              cause: String(cause),
            }),
          ),
        ),
      );

    const runClaimedExecution = (
      row: ClaimedExecutionRow,
      entry: RegisteredWorkflow,
      instance: WorkflowEngine.WorkflowInstance["Service"],
    ) =>
      Effect.scoped(Effect.gen(function* () {
        yield* heartbeatLease(row).pipe(Effect.forkScoped);
        const payload = yield* decodePayload(entry.workflow, row.payload);
        const execution = instance.interrupted
          ? Effect.interrupt
          : entry.execute(payload as object, row.executionId);
        const result = yield* execution.pipe(
          Workflow.intoResult,
          Effect.provideService(WorkflowEngine.WorkflowInstance, instance),
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
        );
        const persisted = yield* persistExecutionResult(row, entry.workflow, result);
        if (persisted && result._tag === "Complete" && row.parentExecutionId) {
          yield* sql`
            UPDATE platform_workflow_execution
            SET resume_requested = TRUE,
                status = CASE WHEN status = 'suspended' THEN 'pending' ELSE status END,
                result_json = CASE WHEN status = 'suspended' THEN NULL ELSE result_json END,
                lease_token = CASE WHEN status = 'suspended' THEN NULL ELSE lease_token END,
                leased_until_ms = CASE
                  WHEN status = 'suspended' THEN NULL
                  ELSE leased_until_ms
                END,
                updated_at_ms = ${Date.now()}
            WHERE execution_id = ${row.parentExecutionId}
              AND status IN ('running', 'suspended')
          `;
          yield* startExecution(row.parentExecutionId);
        }
      })).pipe(
        Effect.onExit((exit) =>
          Exit.isFailure(exit)
            ? releaseFailedExecution(row.executionId, row.leaseToken).pipe(
                Effect.tap(() =>
                  Effect.logError("workflow execution failed before producing a result", {
                    executionId: row.executionId,
                    workflowName: row.workflowName,
                    cause: String(exit.cause),
                  }),
                ),
              )
            : Effect.void,
        ),
      );

    function startExecution(executionId: string): Effect.Effect<void, unknown> {
      if (active.has(executionId)) return Effect.void;
      return Effect.gen(function* () {
        if (active.has(executionId)) return;
        const rows = yield* claimExecution(executionId);
        const row = rows[0];
        if (!row) return;
        const entry = registered.get(row.workflowName);
        if (!entry) {
          yield* releaseUnregistered(executionId, row.leaseToken);
          return;
        }

        const instance = WorkflowEngine.WorkflowInstance.initial(
          entry.workflow,
          executionId,
        );
        instance.interrupted = row.interrupted;
        const activeExecution: ActiveExecution = { instance, interrupt: Effect.void };
        active.set(executionId, activeExecution);
        const fiber = yield* runClaimedExecution(row, entry, instance).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              active.delete(executionId);
            }),
          ),
          Effect.forkIn(entry.scope),
        );
        activeExecution.interrupt = Fiber.interrupt(fiber);
      });
    }

    const pollResult = (workflow: Workflow.Any, executionId: string) =>
      sql<ExecutionResultRow>`
        SELECT result_json AS "result"
        FROM platform_workflow_execution
        WHERE execution_id = ${executionId} AND result_json IS NOT NULL
      `.pipe(
        Effect.flatMap((rows) =>
          rows[0]
            ? decodeWorkflowResult(workflow, rows[0].result).pipe(Effect.map(Option.some))
            : Effect.succeedNone,
        ),
      );

    function waitForResult(
      workflow: Workflow.Any,
      executionId: string,
    ): Effect.Effect<Workflow.Result<unknown, unknown>, unknown> {
      return pollResult(workflow, executionId).pipe(
        Effect.flatMap((result) =>
          Option.isSome(result)
            ? Effect.succeed(result.value)
            : Effect.sleep("20 millis").pipe(
                Effect.andThen(waitForResult(workflow, executionId)),
              ),
        ),
      );
    }

    const ensureExecution = (
      workflow: Workflow.Any,
      executionId: string,
      payload: object,
      parent: WorkflowEngine.WorkflowInstance["Service"] | undefined,
    ) =>
      Effect.gen(function* () {
        const encoded = yield* encodePayload(workflow, payload);
        const now = Date.now();
        yield* sql`
          INSERT INTO platform_workflow_execution (
            execution_id, workflow_name, payload_json, parent_execution_id,
            status, created_at_ms, updated_at_ms
          ) VALUES (
            ${executionId}, ${workflow._tag}, ${encoded}::jsonb,
            ${parent?.executionId ?? null}, 'pending', ${now}, ${now}
          )
          ON CONFLICT (execution_id) DO NOTHING
        `;
      });

    const processDueClocks = Effect.gen(function* () {
      const now = Date.now();
      const rows = yield* sql.withTransaction(
        Effect.gen(function* () {
          const due = yield* sql<DueClockRow>`
            SELECT execution_id AS "executionId", workflow_name AS "workflowName",
                   deferred_name AS "deferredName", exit_json AS "exit"
            FROM platform_workflow_clock
            WHERE due_at_ms <= ${now}
            ORDER BY due_at_ms ASC
            LIMIT 50
            FOR UPDATE SKIP LOCKED
          `;
          yield* Effect.forEach(
            due,
            (clock) =>
              Effect.gen(function* () {
                const encoded = yield* encodeJson(clock.exit);
                yield* sql`
                  INSERT INTO platform_workflow_deferred (
                    execution_id, deferred_name, exit_json, updated_at_ms
                  ) VALUES (
                    ${clock.executionId}, ${clock.deferredName}, ${encoded}::jsonb, ${now}
                  )
                  ON CONFLICT (execution_id, deferred_name) DO NOTHING
                `;
                yield* sql`
                  UPDATE platform_workflow_execution
                  SET resume_requested = TRUE,
                      status = CASE WHEN status = 'suspended' THEN 'pending' ELSE status END,
                      result_json = CASE
                        WHEN status = 'suspended' THEN NULL
                        ELSE result_json
                      END,
                      lease_token = CASE
                        WHEN status = 'suspended' THEN NULL
                        ELSE lease_token
                      END,
                      leased_until_ms = CASE
                        WHEN status = 'suspended' THEN NULL
                        ELSE leased_until_ms
                      END,
                      updated_at_ms = ${now}
                  WHERE execution_id = ${clock.executionId}
                    AND status IN ('running', 'suspended')
                `;
                yield* sql`
                  DELETE FROM platform_workflow_clock
                  WHERE execution_id = ${clock.executionId}
                    AND deferred_name = ${clock.deferredName}
                `;
              }),
            { discard: true },
          );
          return due;
        }),
      );
      yield* Effect.forEach(rows, (row) => startExecution(row.executionId), {
        discard: true,
      });
    });

    const recoverExecutions = Effect.gen(function* () {
      const workflowNames = [...registered.keys()];
      if (workflowNames.length === 0) return;
      const now = Date.now();
      const rows = yield* sql<ExecutionIdRow>`
        SELECT execution_id AS "executionId"
        FROM platform_workflow_execution
        WHERE ${sql.in("workflow_name", workflowNames)}
          AND status IN ('pending', 'running')
          AND (leased_until_ms IS NULL OR leased_until_ms <= ${now})
        ORDER BY updated_at_ms ASC
        LIMIT 50
      `;
      yield* Effect.forEach(rows, (row) => startExecution(row.executionId), {
        discard: true,
      });
    });

    const tick = processDueClocks.pipe(Effect.andThen(recoverExecutions));

    const executeWorkflow = <const Discard extends boolean>(
      workflow: Workflow.Any,
      options: {
        readonly executionId: string;
        readonly payload: object;
        readonly discard: Discard;
        readonly parent?: WorkflowEngine.WorkflowInstance["Service"] | undefined;
      },
    ): Effect.Effect<
      Discard extends true ? void : Workflow.Result<unknown, unknown>
    > =>
      Effect.gen(function* () {
        yield* ensureExecution(
          workflow,
          options.executionId,
          options.payload,
          options.parent,
        );
        yield* startExecution(options.executionId);
        if (options.discard) return;
        return yield* waitForResult(workflow, options.executionId);
      }).pipe(Effect.orDie) as Effect.Effect<
        Discard extends true ? void : Workflow.Result<unknown, unknown>
      >;

    engine = WorkflowEngine.makeUnsafe({
      register: (workflow, execute) =>
        Effect.gen(function* () {
          registered.set(workflow._tag, {
            workflow,
            execute,
            scope: yield* Effect.scope,
          });
          yield* recoverExecutions;
        }).pipe(Effect.orDie),
      execute: executeWorkflow,
      poll: (workflow, executionId) => pollResult(workflow, executionId).pipe(Effect.orDie),
      interrupt: (_workflow, executionId) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE platform_workflow_execution
            SET interrupted = TRUE, resume_requested = FALSE,
                status = 'pending', result_json = NULL,
                lease_token = NULL, leased_until_ms = NULL, updated_at_ms = ${Date.now()}
            WHERE execution_id = ${executionId} AND status <> 'complete'
          `;
          const running = active.get(executionId);
          if (running) {
            running.instance.interrupted = true;
            yield* running.interrupt;
          } else {
            yield* startExecution(executionId);
          }
        }).pipe(Effect.orDie),
      interruptUnsafe: (_workflow, executionId) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE platform_workflow_execution
            SET interrupted = TRUE, resume_requested = FALSE,
                status = 'pending', result_json = NULL,
                lease_token = NULL, leased_until_ms = NULL, updated_at_ms = ${Date.now()}
            WHERE execution_id = ${executionId} AND status <> 'complete'
          `;
          const running = active.get(executionId);
          if (running) {
            running.instance.interrupted = true;
            yield* running.interrupt;
          } else {
            yield* startExecution(executionId);
          }
        }).pipe(Effect.orDie),
      resume: (_workflow, executionId) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE platform_workflow_execution
            SET interrupted = FALSE, resume_requested = FALSE,
                status = 'pending', result_json = NULL,
                lease_token = NULL, leased_until_ms = NULL, updated_at_ms = ${Date.now()}
            WHERE execution_id = ${executionId} AND status <> 'complete'
          `;
          yield* startExecution(executionId);
        }).pipe(Effect.orDie),
      activityExecute: (activity, attempt) =>
        Effect.gen(function* () {
          const parent = yield* WorkflowEngine.WorkflowInstance;
          const rows = yield* sql<ActivityResultRow>`
            SELECT result_json AS "result"
            FROM platform_workflow_activity
            WHERE execution_id = ${parent.executionId}
              AND activity_name = ${activity.name}
              AND attempt = ${attempt}
          `;
          if (rows[0]) {
            const stored = yield* decodeActivityResult(rows[0].result);
            if (stored._tag === "Complete") return stored;
            yield* sql`
              DELETE FROM platform_workflow_activity
              WHERE execution_id = ${parent.executionId}
                AND activity_name = ${activity.name}
                AND attempt = ${attempt}
            `;
          }

          const instance = WorkflowEngine.WorkflowInstance.initial(
            parent.workflow,
            parent.executionId,
          );
          instance.interrupted = parent.interrupted;
          const result = yield* activity.executeEncoded.pipe(
            Workflow.intoResult,
            Effect.provideService(WorkflowEngine.WorkflowInstance, instance),
          );
          const encoded = yield* encodeActivityResult(result);
          yield* sql`
            INSERT INTO platform_workflow_activity (
              execution_id, activity_name, attempt, result_json, updated_at_ms
            ) VALUES (
              ${parent.executionId}, ${activity.name}, ${attempt}, ${encoded}::jsonb,
              ${Date.now()}
            )
            ON CONFLICT (execution_id, activity_name, attempt)
            DO NOTHING
          `;
          return result;
        }).pipe(Effect.orDie),
      deferredResult: (deferred) =>
        Effect.gen(function* () {
          const instance = yield* WorkflowEngine.WorkflowInstance;
          const rows = yield* sql<DeferredResultRow>`
            SELECT exit_json AS "exit"
            FROM platform_workflow_deferred
            WHERE execution_id = ${instance.executionId}
              AND deferred_name = ${deferred.name}
          `;
          return rows[0]
            ? Option.some(rows[0].exit as Exit.Exit<unknown, unknown>)
            : Option.none();
        }).pipe(Effect.orDie),
      deferredDone: (options) =>
        Effect.gen(function* () {
          const encoded = yield* encodeJson(options.exit);
          const now = Date.now();
          yield* sql`
            INSERT INTO platform_workflow_deferred (
              execution_id, deferred_name, exit_json, updated_at_ms
            ) VALUES (
              ${options.executionId}, ${options.deferredName}, ${encoded}::jsonb, ${now}
            )
            ON CONFLICT (execution_id, deferred_name) DO NOTHING
          `;
          yield* sql`
            UPDATE platform_workflow_execution
            SET resume_requested = TRUE,
                status = CASE WHEN status = 'suspended' THEN 'pending' ELSE status END,
                result_json = CASE WHEN status = 'suspended' THEN NULL ELSE result_json END,
                lease_token = CASE WHEN status = 'suspended' THEN NULL ELSE lease_token END,
                leased_until_ms = CASE
                  WHEN status = 'suspended' THEN NULL
                  ELSE leased_until_ms
                END,
                updated_at_ms = ${now}
            WHERE execution_id = ${options.executionId}
              AND status IN ('running', 'suspended')
          `;
          yield* startExecution(options.executionId);
        }).pipe(Effect.orDie),
      scheduleClock: (workflow, options) =>
        Effect.gen(function* () {
          const exitCodec = options.clock.deferred.exitSchema as unknown as Schema.Codec<
            Exit.Exit<unknown, unknown>,
            Schema.Json,
            never
          >;
          const encodedExit = yield* Schema.encodeEffect(exitCodec)(Exit.void).pipe(
            Effect.flatMap(encodeJson),
          );
          const now = Date.now();
          const dueAt = now + Duration.toMillis(options.clock.duration);
          yield* sql`
            INSERT INTO platform_workflow_clock (
              execution_id, workflow_name, deferred_name, due_at_ms,
              exit_json, created_at_ms
            ) VALUES (
              ${options.executionId}, ${workflow._tag}, ${options.clock.deferred.name},
              ${dueAt}, ${encodedExit}::jsonb, ${now}
            )
            ON CONFLICT (execution_id, deferred_name) DO NOTHING
          `;
        }).pipe(Effect.orDie),
    });

    yield* Effect.forever(
      tick.pipe(
        Effect.catchCause((cause) =>
          Effect.logError("workflow runner tick failed", { cause: String(cause) }),
        ),
        Effect.andThen(Effect.sleep("100 millis")),
      ),
    ).pipe(Effect.forkIn(scope));

    return engine;
  });

/** Postgres-backed Effect workflow engine with durable activities and clocks. */
export const PgWorkflowEngineLive = (
  config: PgPlatformConfig,
): Layer.Layer<WorkflowEngine.WorkflowEngine> =>
  Layer.effect(
    WorkflowEngine.WorkflowEngine,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* ensureTables(sql);
      return yield* makePgEngine(sql);
    }),
  ).pipe(Layer.provide(PgPlatformClientLive(config)), Layer.orDie);
