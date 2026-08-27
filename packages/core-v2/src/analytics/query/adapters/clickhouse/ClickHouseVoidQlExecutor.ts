import { Effect, Layer, Schema } from "effect";

import { AnalyticsPortError } from "../../../application/ports.ts";
import { ClickHouseAnalyticsClient } from "../../../ingest/adapters/clickhouse/ClickHouseAnalyticsStore.ts";
import { VoidQlExecutor, type VoidQlExecutorShape } from "../../application/VoidQlQuery.ts";

const VoidQlRows = Schema.Array(Schema.Record(Schema.String, Schema.Unknown));

const makeClickHouseVoidQlExecutor = Effect.gen(function* () {
  const client = yield* ClickHouseAnalyticsClient;
  return {
    execute: (input) =>
      client
        .query<Record<string, unknown>>({
          name: "analytics.voidql",
          params: input.statement.params,
          queryId: input.queryId,
          quotaKey: input.quotaKey,
          sql: input.statement.sql,
        })
        .pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(VoidQlRows)),
          Effect.mapError(
            (cause) =>
              new AnalyticsPortError({ cause, message: "failed to execute VoidQL statement" }),
          ),
        ),
  } satisfies VoidQlExecutorShape;
});

/** Execute verified VoidQL statements through the ClickHouse client service. */
export const ClickHouseVoidQlExecutorLive = Layer.effect(VoidQlExecutor)(
  makeClickHouseVoidQlExecutor,
);
