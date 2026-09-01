import * as Context from "effect/Context";
import * as Schema from "effect/Schema";
import type * as Effect from "effect/Effect";

import type { CapturedEventV1 } from "../../ingest/domain/Ingest.ts";

/** Per-envelope processing outcomes reported by a delivery implementation. */
export const AnalyticsDeliveryOutcome = Schema.Struct({
  /** Envelopes processed but dead-lettered instead of stored. */
  deadLettered: Schema.Int,
  /** Envelopes processed and stored. */
  stored: Schema.Int,
});
export type AnalyticsDeliveryOutcome = typeof AnalyticsDeliveryOutcome.Type;

/** Delivery failure carrying the number of envelopes confirmed before failure. */
export class AnalyticsDeliveryError extends Schema.TaggedErrorClass<AnalyticsDeliveryError>()(
  "AnalyticsDeliveryError",
  {
    /** Original dependency failure retained for diagnostics. */
    cause: Schema.Unknown,
    /** Envelopes confirmed dead-lettered before the failure. */
    deadLettered: Schema.Int,
    /** Safe summary of the failed delivery operation. */
    message: Schema.String,
    /** Envelopes confirmed stored before the failure. */
    stored: Schema.Int,
  },
) {}

/** Delivery capabilities shared by inline and queued implementations. */
export interface AnalyticsDeliveryShape {
  /**
   * Hands accepted capture envelopes to the configured processing path. Every
   * envelope is attempted before a hard failure is reported, and the outcome
   * distinguishes stored from dead-lettered envelopes. Queue-backed delivery
   * reports durable queue acceptance optimistically as `stored`; only inline
   * delivery can report the processor's final dead-letter outcome here.
   */
  readonly deliver: (
    envelopes: ReadonlyArray<typeof CapturedEventV1.Type>,
  ) => Effect.Effect<typeof AnalyticsDeliveryOutcome.Type, AnalyticsDeliveryError>;
}

/** Boundary between capture and either inline or queued event processing. */
export class AnalyticsDelivery extends Context.Service<AnalyticsDelivery, AnalyticsDeliveryShape>()(
  "@voidhash/core-v2/analytics/AnalyticsDelivery",
) {}
