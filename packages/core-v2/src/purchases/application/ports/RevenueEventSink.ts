import { Context, Schema, type Effect } from "effect";

import type { RevenueEventSchema } from "../../contract/RevenueEvents.ts";

/** Per-event outcomes confirmed by a revenue delivery adapter. */
export const RevenueEventDeliveryOutcome = Schema.Struct({
  deadLettered: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  stored: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/** Failure reported by the infrastructure responsible for revenue delivery. */
export class RevenueEventSinkError extends Schema.TaggedErrorClass<RevenueEventSinkError>(
  "RevenueEventSinkError",
)("RevenueEventSinkError", {
  cause: Schema.Unknown,
  message: Schema.String,
}) {}

export interface RevenueEventSinkShape {
  /**
   * Hands validated purchase events to an asynchronous or inline sink. Queued
   * adapters acknowledge durable queue acceptance as `stored`; inline adapters
   * report the processor's final stored/dead-lettered result.
   */
  readonly deliver: (
    events: ReadonlyArray<typeof RevenueEventSchema.Type>,
  ) => Effect.Effect<typeof RevenueEventDeliveryOutcome.Type, RevenueEventSinkError>;
}

/** Purchase-owned boundary for delivering outbox revenue events. */
export class RevenueEventSink extends Context.Service<RevenueEventSink, RevenueEventSinkShape>()(
  "@voidhash/core-v2/purchases/RevenueEventSink",
) {}
