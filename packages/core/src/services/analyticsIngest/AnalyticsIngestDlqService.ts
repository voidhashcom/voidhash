import {
  analyticsIngestDlq,
  AnalyticsIngestDlqReplayStatus,
  Db,
  desc,
  eq,
  sql,
} from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

import type { RouteClass } from "../../domain/analyticsIngest/AnalyticsIngest.ts";
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
        return yield* db
          .select()
          .from(analyticsIngestDlq)
          .where(
            input.projectId && input.failureClass
              ? sql`${analyticsIngestDlq.projectId} = ${input.projectId} AND ${analyticsIngestDlq.failureClass} = ${input.failureClass}`
              : input.projectId
                ? eq(analyticsIngestDlq.projectId, input.projectId)
                : input.failureClass
                  ? eq(analyticsIngestDlq.failureClass, input.failureClass)
                  : undefined,
          )
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
        yield* ingress.enqueueBatch([
          {
            envelope: row.payloadJson as never,
            routeClass: row.routeClass as RouteClass,
          },
        ]);
        yield* markReplayed(id);
      });

      return { listFailures, markReplayed, recordFailure, requeueFailure } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(AnalyticsIngestDlqService)(AnalyticsIngestDlqService.make);
}
