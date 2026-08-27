import { Context, type Effect } from "effect";

import type { CapturedEventV1 } from "../../ingest/domain/Ingest.ts";
import type { AnalyticsPortError } from "./AnalyticsPortError.ts";

/** Delivery capabilities shared by inline and queued implementations. */
export interface AnalyticsDeliveryShape {
  /** Hands accepted capture envelopes to the configured processing path. */
  readonly deliver: (
    envelopes: ReadonlyArray<typeof CapturedEventV1.Type>,
  ) => Effect.Effect<void, AnalyticsPortError>;
}

/** Boundary between capture and either inline or queued event processing. */
export class AnalyticsDelivery extends Context.Service<AnalyticsDelivery, AnalyticsDeliveryShape>()(
  "@voidhash/core-v2/analytics/AnalyticsDelivery",
) {}
