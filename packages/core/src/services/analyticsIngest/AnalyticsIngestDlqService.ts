import {
  analyticsIngestDlq,
  AnalyticsIngestDlqReplayStatus,
  Db,
  desc,
  eq,
  sql,
} from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import { Context, Effect, Layer, Schema } from "effect";

import type { RouteClass } from "../../domain/analyticsIngest/AnalyticsIngest.ts";
import { CapturedEventV1 } from "../../domain/analyticsIngest/AnalyticsIngest.ts";
import { generateId } from "../../utils/generate-id.ts";
import { CaptureIngress } from "./CaptureIngress.ts";

export class AnalyticsIngestDlqServiceError extends Schema.TaggedErrorClass<AnalyticsIngestDlqServiceError>(
  "AnalyticsIngestDlqServiceError",
)("AnalyticsIngestDlqServiceError", { cause: Schema.String }) {}

export interface AnalyticsIngestDlqRecordFailureInput {
  readonly attemptCount: number;
  readonly captureId?: string;
  readonly distinctId?: string;
  readonly failureClass: string;
  readonly failureMessage: string;
  readonly payloadJson: unknown;
  readonly projectId: string;
  readonly routeClass: RouteClass;
  readonly sourceSequence: number;
  readonly sourceShard: string;
}

const decodeCapturedEvent = Schema.decodeUnknownEffect(CapturedEventV1);
const decodeRouteClass = Schema.decodeUnknownEffect(
  Schema.Literals(["main", "dlq", "overflow", "historical", "custom"]),
);

export interface AnalyticsIngestDlqListInput {
  readonly failureClass?: string;
  readonly limit?: number;
  readonly projectId?: string;
}

export class AnalyticsIngestDlqService extends Context.Service<AnalyticsIngestDlqService>()(
  "AnalyticsIngestDlqService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const recordFailure = Effect.fn("analyticsIngestDlq.recordFailure")(function* (
        input: AnalyticsIngestDlqRecordFailureInput,
      ) {
        const id = generateId("analyticsIngestDlq");
        yield* Effect.annotateCurrentSpan("voidhash.dlq.id", id);
        yield* Effect.annotateCurrentSpan("voidhash.dlq.failure_class", input.failureClass);
        yield* Effect.annotateCurrentSpan("voidhash.capture.route_class", input.routeClass);
        if (input.projectId)
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        if (input.captureId)
          yield* Effect.annotateCurrentSpan("voidhash.capture.id", input.captureId);
        if (input.distinctId)
          yield* Effect.annotateCurrentSpan("voidhash.person.distinct_id", input.distinctId);
        yield* db
          .insert(analyticsIngestDlq)
          .values({
            attemptCount: input.attemptCount,
            captureId: input.captureId,
            distinctId: input.distinctId,
            failureClass: input.failureClass,
            failureMessage: input.failureMessage,
            id,
            payloadJson: input.payloadJson,
            projectId: input.projectId,
            routeClass: input.routeClass,
            sourceSequence: input.sourceSequence,
            sourceShard: input.sourceShard,
          })
          .onConflictDoUpdate({
            target: analyticsIngestDlq.captureId,
            set: {
              attemptCount: input.attemptCount,
              failureClass: input.failureClass,
              failureMessage: input.failureMessage,
              payloadJson: input.payloadJson,
              replayStatus: AnalyticsIngestDlqReplayStatus.Pending,
              updatedAt: sql`CURRENT_TIMESTAMP`,
            },
          });
        return id;
      });

      const listFailures = Effect.fn("analyticsIngestDlq.listFailures")(function* (
        input: AnalyticsIngestDlqListInput = {},
      ) {
        const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
        if (input.projectId)
          yield* Effect.annotateCurrentSpan("voidhash.project.id", input.projectId);
        if (input.failureClass)
          yield* Effect.annotateCurrentSpan("voidhash.dlq.failure_class", input.failureClass);
        const filter = () => {
          if (input.projectId && input.failureClass)
            return sql`${analyticsIngestDlq.projectId} = ${input.projectId} AND ${analyticsIngestDlq.failureClass} = ${input.failureClass}`;
          if (input.projectId) return eq(analyticsIngestDlq.projectId, input.projectId);
          if (input.failureClass) return eq(analyticsIngestDlq.failureClass, input.failureClass);
          return undefined;
        };
        return yield* db
          .select()
          .from(analyticsIngestDlq)
          .where(filter())
          .orderBy(desc(analyticsIngestDlq.createdAt))
          .limit(limit);
      });

      const markReplayed = Effect.fn("analyticsIngestDlq.markReplayed")(function* (id: string) {
        yield* Effect.annotateCurrentSpan("voidhash.dlq.id", id);
        yield* db
          .update(analyticsIngestDlq)
          .set({
            replayedAt: sql`CURRENT_TIMESTAMP`,
            replayStatus: AnalyticsIngestDlqReplayStatus.Requeued,
          })
          .where(eq(analyticsIngestDlq.id, id));
      });

      const requeueFailure = Effect.fn("analyticsIngestDlq.requeueFailure")(function* (id: string) {
        yield* Effect.annotateCurrentSpan("voidhash.dlq.id", id);
        const ingress = yield* CaptureIngress;
        const row = yield* db.query.analyticsIngestDlq.findFirst({
          where: { id },
        });
        if (!row) {
          return yield* Effect.fail(
            new AnalyticsIngestDlqServiceError({ cause: `DLQ row ${id} not found` }),
          );
        }
        if (row.projectId) yield* Effect.annotateCurrentSpan("voidhash.project.id", row.projectId);
        if (row.routeClass)
          yield* Effect.annotateCurrentSpan("voidhash.capture.route_class", row.routeClass);
        const envelope = yield* decodeCapturedEvent(row.payloadJson).pipe(
          Effect.mapError(
            (cause) =>
              new AnalyticsIngestDlqServiceError({
                cause: `DLQ row ${id} payload is not a captured event: ${cause.message}`,
              }),
          ),
        );
        const routeClass = yield* decodeRouteClass(row.routeClass).pipe(
          Effect.mapError(
            (cause) =>
              new AnalyticsIngestDlqServiceError({
                cause: `DLQ row ${id} has an unknown route class: ${cause.message}`,
              }),
          ),
        );
        yield* ingress.enqueueBatch([{ envelope, routeClass }]);
        yield* markReplayed(id);
      });

      return constant({ listFailures, markReplayed, recordFailure, requeueFailure });
    }),
  },
) {
  static readonly layer = Layer.effect(AnalyticsIngestDlqService)(AnalyticsIngestDlqService.make);
}
