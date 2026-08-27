import { Context, type Effect, Schema } from "effect";

import { CaptureProjectPolicy } from "../../ingest/domain/Ingest.ts";
import type { AnalyticsPortError } from "./AnalyticsPortError.ts";

/** Project identity and admission policy resolved from capture credentials. */
export const ResolvedCaptureProject = Schema.Struct({
  organizationId: Schema.String,
  projectId: Schema.String,
  policy: CaptureProjectPolicy,
});

/** Credential lookup capabilities required by capture. */
export interface CaptureCredentialRepositoryShape {
  /** Returns no project when the credential is unknown or inactive. */
  readonly resolve: (input: {
    /** Whether `lookupKey` is a public credential rather than a secret credential lookup. */
    readonly isPublic: boolean;
    readonly lookupKey: string;
  }) => Effect.Effect<typeof ResolvedCaptureProject.Type | undefined, AnalyticsPortError>;
}

/** Resolves public or secret capture credentials to their project policy. */
export class CaptureCredentialRepository extends Context.Service<
  CaptureCredentialRepository,
  CaptureCredentialRepositoryShape
>()("@voidhash/core-v2/analytics/CaptureCredentialRepository") {}

/** Quota-counter capabilities required by capture. */
export interface PolicyCounterShape {
  /** Checks whether a capture request is within its per-minute limit. */
  readonly checkRequest: (input: {
    readonly now: Date;
    readonly projectId: string;
    readonly requestsPerMinute?: number;
  }) => Effect.Effect<
    { readonly allowed: boolean; readonly retryAfterMs?: number },
    AnalyticsPortError
  >;
  /** Checks whether an event is within its per-day limit. */
  readonly checkEvent: (input: {
    readonly now: Date;
    readonly projectId: string;
    readonly eventsPerDay?: number;
  }) => Effect.Effect<boolean, AnalyticsPortError>;
}

/** Enforces request- and event-level project quotas. */
export class PolicyCounter extends Context.Service<PolicyCounter, PolicyCounterShape>()(
  "@voidhash/core-v2/analytics/PolicyCounter",
) {}
