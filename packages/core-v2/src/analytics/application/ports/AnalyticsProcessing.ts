import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Schema from "effect/Schema";

import type {
  CapturedEventV1,
  EventProcessorDlqV1,
  ResolvedProcessorProject,
} from "../../ingest/domain/Ingest.ts";
import type { AnalyticsPortError } from "./AnalyticsPortError.ts";

/** Project-repository capabilities required by the processor. */
export interface ProcessorProjectRepositoryShape {
  /** Returns no project when the captured credential can no longer be resolved. */
  readonly resolve: (
    capturedEvent: typeof CapturedEventV1.Type,
  ) => Effect.Effect<
    typeof ResolvedProcessorProject.Type | typeof Schema.Undefined.Type,
    AnalyticsPortError
  >;
}

/** Resolves authoritative project data while processing a captured event. */
export class ProcessorProjectRepository extends Context.Service<
  ProcessorProjectRepository,
  ProcessorProjectRepositoryShape
>()("@voidhash/core-v2/analytics/ProcessorProjectRepository") {}

/** Dead-letter persistence capabilities required by the processor. */
export interface AnalyticsDeadLetterStoreShape {
  /** Writes failed processor records for later inspection or recovery. */
  readonly write: (
    events: ReadonlyArray<typeof EventProcessorDlqV1.Type>,
  ) => Effect.Effect<void, AnalyticsPortError>;
}

/** Persists events that processing cannot safely accept or retry. */
export class AnalyticsDeadLetterStore extends Context.Service<
  AnalyticsDeadLetterStore,
  AnalyticsDeadLetterStoreShape
>()("@voidhash/core-v2/analytics/AnalyticsDeadLetterStore") {}
