import type {
  ProcessedEventV2Type,
  ProcessorPersonEventV1Type,
  ProcessorPersonIdentityEventV1Type,
} from "../../domain/analyticsIngest/AnalyticsIngest.ts";

/** Analytics processor outputs collected by a durable ingest flush workflow. */
export interface ProcessorOutputs {
  readonly processedEvents: ReadonlyArray<ProcessedEventV2Type>;
  readonly personEvents: ReadonlyArray<ProcessorPersonEventV1Type>;
  readonly personIdentityEvents: ReadonlyArray<ProcessorPersonIdentityEventV1Type>;
}
