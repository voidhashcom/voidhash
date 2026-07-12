import {
  QueueConsumerError,
  type QueueConsumerOptions,
  QueueDriver,
  type QueueDriverShape,
  QueueProducerError,
  type QueueProducer,
} from "@voidhash/platform/Queue";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Cause, Duration, Effect, Layer, Schema, SchemaParser } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { PgPlatformClientLive, type PgPlatformConfig } from "./Postgres.ts";

interface QueueRow {
  readonly id: string;
  readonly body: unknown;
  readonly attempt: number | string;
  readonly sequence: number | string;
}

interface DecodedQueueRow<A> {
  readonly row: QueueRow;
  readonly message: A;
}

const defaultOptions = {
  batchSize: 10,
  maxRetries: 3,
  retryDelayMillis: 1_000,
  visibilityTimeoutMillis: 30_000,
  pollIntervalMillis: 250,
} as const;

const positiveInteger = (value: number | undefined, fallback: number): number =>
  value === undefined || !Number.isFinite(value) || value <= 0
    ? fallback
    : Math.floor(value);

const nonNegativeInteger = (value: number | undefined, fallback: number): number =>
  value === undefined || !Number.isFinite(value) || value < 0
    ? fallback
    : Math.floor(value);

const resolvedOptions = (options: QueueConsumerOptions | undefined) => ({
  batchSize: positiveInteger(options?.batchSize, defaultOptions.batchSize),
  maxRetries: nonNegativeInteger(options?.maxRetries, defaultOptions.maxRetries),
  retryDelayMillis: nonNegativeInteger(
    options?.retryDelayMillis,
    defaultOptions.retryDelayMillis,
  ),
  visibilityTimeoutMillis: positiveInteger(
    options?.visibilityTimeoutMillis,
    defaultOptions.visibilityTimeoutMillis,
  ),
  pollIntervalMillis: positiveInteger(
    options?.pollIntervalMillis,
    defaultOptions.pollIntervalMillis,
  ),
  deadLetterQueue: options?.deadLetterQueue,
});

const encodeJson = (value: unknown): Effect.Effect<string, unknown> =>
  Effect.try({
    try: () => {
      const encoded = JSON.stringify(value);
      if (encoded === undefined) throw new TypeError("Queue messages must be JSON-serializable");
      return encoded;
    },
    catch: (cause) => cause,
  });

const ensureTable = (sql: SqlClient.SqlClient) =>
  sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`SELECT pg_advisory_xact_lock(hashtext('voidhash_platform_queue_schema_v1'))`;
      yield* sql`
        CREATE TABLE IF NOT EXISTS platform_queue_messages (
          id TEXT PRIMARY KEY,
          queue_name TEXT NOT NULL,
          body_json JSONB NOT NULL,
          attempt INTEGER NOT NULL DEFAULT 0,
          available_at_ms BIGINT NOT NULL,
          leased_until_ms BIGINT,
          created_at_ms BIGINT NOT NULL,
          last_error TEXT,
          sequence BIGSERIAL NOT NULL
        )
      `;
      yield* sql`
        ALTER TABLE platform_queue_messages
        ADD COLUMN IF NOT EXISTS sequence BIGSERIAL
      `;
      yield* sql`
        CREATE INDEX IF NOT EXISTS platform_queue_messages_claim_v2_idx
        ON platform_queue_messages (queue_name, available_at_ms, sequence)
      `;
    }),
  );

const producerError = (queueName: string, cause: unknown) =>
  new QueueProducerError({ queueName, cause: String(cause) });

const consumerError = (queueName: string, cause: unknown) =>
  new QueueConsumerError({ queueName, cause: String(cause) });

const makeProducer = <A, I>(
  sql: SqlClient.SqlClient,
  queueName: string,
  schema: Schema.Codec<A, I>,
): QueueProducer<A> => {
  const encode = SchemaParser.encodeUnknownEffect(schema);

  const publishEncoded = (encoded: unknown) =>
    Effect.gen(function* () {
      const body = yield* encodeJson(encoded);
      const now = Date.now();
      yield* sql`
        INSERT INTO platform_queue_messages (
          id, queue_name, body_json, available_at_ms, created_at_ms
        ) VALUES (
          ${crypto.randomUUID()}, ${queueName}, ${body}::jsonb, ${now}, ${now}
        )
      `;
    });

  const publish = (message: A) =>
    PlatformRuntime.pipe(
      Effect.andThen(encode(message)),
      Effect.flatMap(publishEncoded),
      Effect.mapError((cause) => producerError(queueName, cause)),
    );

  const publishBatch = (messages: ReadonlyArray<A>) =>
    PlatformRuntime.pipe(
      Effect.andThen(Effect.forEach(messages, (message) => encode(message))),
      Effect.flatMap((encoded) =>
        sql.withTransaction(Effect.forEach(encoded, publishEncoded, { discard: true })),
      ),
      Effect.mapError((cause) => producerError(queueName, cause)),
    );

  return { publish, publishBatch };
};

const claimBatch = (
  sql: SqlClient.SqlClient,
  queueName: string,
  options: ReturnType<typeof resolvedOptions>,
) =>
  Effect.suspend(() => {
    const now = Date.now();
    return sql<QueueRow>`
      WITH claimed AS (
        SELECT id
        FROM platform_queue_messages
        WHERE queue_name = ${queueName}
          AND available_at_ms <= ${now}
          AND (leased_until_ms IS NULL OR leased_until_ms <= ${now})
        ORDER BY sequence ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${options.batchSize}
      )
      UPDATE platform_queue_messages AS message
      SET attempt = message.attempt + 1,
          leased_until_ms = ${now + options.visibilityTimeoutMillis}
      FROM claimed
      WHERE message.id = claimed.id
      RETURNING message.id, message.body_json AS "body", message.attempt, message.sequence
    `.pipe(
      Effect.map((rows) =>
        [...rows].sort((left, right) => Number(left.sequence) - Number(right.sequence)),
      ),
    );
  });

const deleteRows = (sql: SqlClient.SqlClient, rows: ReadonlyArray<QueueRow>) =>
  sql.withTransaction(
    Effect.forEach(
      rows,
      (row) =>
        sql`
          DELETE FROM platform_queue_messages
          WHERE id = ${row.id}
        `,
      { discard: true },
    ),
  );

const retryRows = (
  sql: SqlClient.SqlClient,
  rows: ReadonlyArray<QueueRow>,
  queueName: string,
  options: ReturnType<typeof resolvedOptions>,
  cause: Cause.Cause<unknown>,
) => {
  const now = Date.now();
  const maxAttempts = options.maxRetries + 1;
  const error = Cause.pretty(cause);
  return sql.withTransaction(
    Effect.forEach(
      rows,
      (row) => {
        if (Number(row.attempt) < maxAttempts) {
          return sql`
            UPDATE platform_queue_messages
            SET available_at_ms = ${now + options.retryDelayMillis},
                leased_until_ms = NULL,
                last_error = ${error}
            WHERE id = ${row.id}
          `;
        }
        if (options.deadLetterQueue) {
          return Effect.gen(function* () {
            const body = yield* encodeJson(row.body);
            yield* sql`
              INSERT INTO platform_queue_messages (
                id, queue_name, body_json, available_at_ms, created_at_ms, last_error
              ) VALUES (
                ${crypto.randomUUID()}, ${options.deadLetterQueue}, ${body}::jsonb,
                ${now}, ${now}, ${error}
              )
            `;
            yield* sql`
              DELETE FROM platform_queue_messages
              WHERE id = ${row.id}
            `;
          });
        }
        return sql`
          DELETE FROM platform_queue_messages
          WHERE id = ${row.id}
        `;
      },
      { discard: true },
    ),
  ).pipe(
    Effect.tap(() =>
      Effect.logWarning("queue batch failed; delivery state updated", {
        queueName,
        messageCount: rows.length,
        cause: error,
      }),
    ),
  );
};

const processBatch = <A, I, R>(
  sql: SqlClient.SqlClient,
  queueName: string,
  schema: Schema.Codec<A, I>,
  handleBatch: (messages: ReadonlyArray<A>) => Effect.Effect<void, unknown, R>,
  inputOptions: QueueConsumerOptions | undefined,
): Effect.Effect<number, QueueConsumerError, PlatformRuntime | R> => {
  const options = resolvedOptions(inputOptions);
  const decode = SchemaParser.decodeUnknownEffect(schema);

  return PlatformRuntime.pipe(
    Effect.andThen(claimBatch(sql, queueName, options)),
    Effect.flatMap((rows) =>
      Effect.gen(function* () {
        if (rows.length === 0) return 0;

        const decoded: Array<DecodedQueueRow<A>> = [];
        const poison: Array<QueueRow> = [];
        yield* Effect.forEach(
          rows,
          (row) =>
            decode(row.body).pipe(
              Effect.matchCauseEffect({
                onFailure: (cause) =>
                  Effect.logWarning("queue payload decode failed; acking poison message", {
                    queueName,
                    messageId: row.id,
                    cause: Cause.pretty(cause),
                  }).pipe(
                    Effect.tap(() =>
                      Effect.sync(() => {
                        poison.push(row);
                      }),
                    ),
                  ),
                onSuccess: (message) =>
                  Effect.sync(() => {
                    decoded.push({ row, message });
                  }),
              }),
            ),
          { discard: true },
        );

        if (poison.length > 0) yield* deleteRows(sql, poison);
        if (decoded.length === 0) return rows.length;

        yield* handleBatch(decoded.map(({ message }) => message)).pipe(
          Effect.matchCauseEffect({
            onFailure: (cause) =>
              retryRows(
                sql,
                decoded.map(({ row }) => row),
                queueName,
                options,
                cause,
              ),
            onSuccess: () => deleteRows(sql, decoded.map(({ row }) => row)),
          }),
        );
        return rows.length;
      }),
    ),
    Effect.mapError((cause) => consumerError(queueName, cause)),
  );
};

const makeQueueDriver = (sql: SqlClient.SqlClient): QueueDriverShape => ({
  producer: (queueName, schema) => makeProducer(sql, queueName, schema),
  processBatch: (queueName, schema, handleBatch, options) =>
    processBatch(sql, queueName, schema, handleBatch, options),
  consumeBatch: (queueName, schema, handleBatch, options) => {
    const resolved = resolvedOptions(options);
    return Effect.forever(
      processBatch(sql, queueName, schema, handleBatch, options).pipe(
        Effect.flatMap((count) =>
          count === 0
            ? Effect.sleep(Duration.millis(resolved.pollIntervalMillis))
            : Effect.void,
        ),
      ),
    );
  },
});

/** Postgres-backed queue driver with durable leases, retries, and dead letters. */
export const PgQueueLive = (config: PgPlatformConfig): Layer.Layer<QueueDriver> =>
  Layer.effect(
    QueueDriver,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* ensureTable(sql);
      return makeQueueDriver(sql);
    }),
  ).pipe(Layer.provide(PgPlatformClientLive(config)), Layer.orDie);
