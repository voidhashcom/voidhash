import { Context, type Effect } from "effect";
import type { AuthSession } from "@voidhash/rpc";

import type { AnalyticsPortError } from "./AnalyticsPortError.ts";

/** Authorization capabilities used by analytics query applications. */
export interface AnalyticsAuthorizerShape {
  /** Returns every project the caller may query within an organization. */
  readonly organizationProjects: (
    organizationId: string,
  ) => Effect.Effect<ReadonlyArray<string>, AnalyticsPortError, AuthSession>;
  /** Succeeds only when the caller may query the requested project. */
  readonly requireProject: (
    projectId: string,
  ) => Effect.Effect<void, AnalyticsPortError, AuthSession>;
}

/** Authorization boundary used by analytics query applications. */
export class AnalyticsAuthorizer extends Context.Service<
  AnalyticsAuthorizer,
  AnalyticsAuthorizerShape
>()("@voidhash/core-v2/analytics/AnalyticsAuthorizer") {}
