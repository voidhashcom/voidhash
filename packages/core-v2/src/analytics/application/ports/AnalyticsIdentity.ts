import { Context, type Effect, Schema } from "effect";

import type { CapturedTransportRecord } from "../../ingest/domain/Ingest.ts";
import {
  ProcessorPersonEventV1,
  ProcessorPersonIdentityEventV1,
} from "../../ingest/domain/Ingest.ts";
import type { AnalyticsPortError } from "./AnalyticsPortError.ts";

/** Identity attached to a canonical analytics event. */
export const ResolvedAnalyticsIdentity = Schema.Struct({
  distinctId: Schema.String,
  /** Whether the event participates in person profiles and identity merging. */
  mode: Schema.Literals(["full", "personless"]),
  /** Stable profile identifier, present only for full identity resolution. */
  personId: Schema.optional(Schema.String),
});

/** Resolved event identity plus the projections produced while resolving it. */
export const IdentityResolution = Schema.Struct({
  identity: ResolvedAnalyticsIdentity,
  personEvents: Schema.Array(ProcessorPersonEventV1),
  personIdentityEvents: Schema.Array(ProcessorPersonIdentityEventV1),
});

/** Identity-resolution capabilities used by the analytics processor. */
export interface AnalyticsIdentityResolverShape {
  /** Resolves one captured record and returns any required identity projections. */
  readonly resolve: (
    record: typeof CapturedTransportRecord.Type,
  ) => Effect.Effect<typeof IdentityResolution.Type, AnalyticsPortError>;
}

/** Resolves captured identifiers into canonical analytics identity data. */
export class AnalyticsIdentityResolver extends Context.Service<
  AnalyticsIdentityResolver,
  AnalyticsIdentityResolverShape
>()("@voidhash/core-v2/analytics/AnalyticsIdentityResolver") {}
