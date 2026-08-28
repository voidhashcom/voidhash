import { Context, Schema, type Effect } from "effect";
import type { AuthSession } from "@voidhash/rpc";

import type { AnalyticsPortError } from "./AnalyticsPortError.ts";

/**
 * The caller is not allowed to query the requested scope. Distinct from a
 * {@link AnalyticsPortError} so callers can map denials to an authorization
 * failure (e.g. HTTP 403) instead of an infrastructure error.
 */
export class AnalyticsAuthorizationDeniedError extends Schema.TaggedErrorClass<AnalyticsAuthorizationDeniedError>(
  "AnalyticsAuthorizationDeniedError",
)("AnalyticsAuthorizationDeniedError", { message: Schema.String }) {}

/** Authorization capabilities used by analytics query applications. */
export interface AnalyticsAuthorizerShape {
  /** Returns every project the caller may query within an organization. */
  readonly organizationProjects: (
    organizationId: string,
  ) => Effect.Effect<
    ReadonlyArray<string>,
    AnalyticsPortError | AnalyticsAuthorizationDeniedError,
    AuthSession
  >;
  /** Succeeds only when the caller may query the requested project. */
  readonly requireProject: (
    projectId: string,
  ) => Effect.Effect<void, AnalyticsPortError | AnalyticsAuthorizationDeniedError, AuthSession>;
}

/** Authorization boundary used by analytics query applications. */
export class AnalyticsAuthorizer extends Context.Service<
  AnalyticsAuthorizer,
  AnalyticsAuthorizerShape
>()("@voidhash/core-v2/analytics/AnalyticsAuthorizer") {}
