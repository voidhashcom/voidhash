/**
 * `EventCaptureService` orchestrates the capture pipeline: validate the inbound
 * token, resolve the project + policy, enforce the request rate limit, then for
 * each event enforce the per-event quota, pick a destination route, build the
 * wire-stable {@link CapturedEventV1} envelope, and hand accepted envelopes to
 * {@link CaptureIngress}.
 *
 * `CaptureRateLimitedError` / `CaptureUnauthorizedError` are part of the public
 * HTTP contract and pass through as typed errors; every other infrastructural
 * failure is wrapped as {@link EventCaptureServiceError} at the method boundary.
 */
import {
  CaptureRateLimitedError,
  CaptureUnauthorizedError,
  type CaptureEvent,
} from "@voidhash/api-contracts/event-capture";
import { ANONYMOUS_USER_ID_PREFIX } from "@voidhash/lib";
import { Context, Effect, Layer, Schema } from "effect";

import {
  type CaptureProjectPolicy,
  type CapturedEventV1Type,
  defaultCaptureProjectPolicy,
  type RouteClass,
  type RouteDecision,
} from "../../domain/analyticsIngest/AnalyticsIngest.ts";
import { and, apiKeys, captureProjectPolicies, Db, eq, projects } from "@voidhash/db";
import {
  isReservedRevenueEventName,
  shouldBypassQuota,
} from "../../domain/internalAnalytics/InternalAnalyticsEvents.ts";
import { CaptureIngress } from "./CaptureIngress.ts";
import { PolicyCounterStore } from "./PolicyCounterStore.ts";

export class EventCaptureServiceError extends Schema.TaggedErrorClass<EventCaptureServiceError>(
  "EventCaptureServiceError",
)("EventCaptureServiceError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

export interface CaptureRequest {
  readonly request: {
    readonly path?: string;
    readonly token: string;
    readonly sentAt: Date;
    readonly receivedAt: Date;
    readonly clientIp?: string;
    readonly requestId: string;
    readonly headers: Readonly<Record<string, string | undefined>>;
  };
  readonly events: ReadonlyArray<typeof CaptureEvent.Type>;
}

export interface CaptureResult {
  readonly accepted: number;
  readonly rejected: number;
}

interface ResolvedCaptureProject {
  readonly organizationId: string;
  readonly policy: CaptureProjectPolicy;
  readonly projectId: string;
}

const parseForceRoute = (value: string | null | undefined): RouteClass | undefined => {
  if (
    value === "custom" ||
    value === "dlq" ||
    value === "historical" ||
    value === "main" ||
    value === "overflow"
  ) {
    return value;
  }
  return undefined;
};

/** Stable per-lane topic strings carried in the envelope's `routing.targetTopic`. */
export const CAPTURE_TOPIC_MAIN = "capture.main.v1" as const;
export const CAPTURE_TOPIC_OVERFLOW = "capture.overflow.v1" as const;
export const CAPTURE_TOPIC_HISTORICAL = "capture.historical.v1" as const;
export const CAPTURE_TOPIC_DLQ = "capture.dlq.v1" as const;

const TOKEN_FORMAT = /^vh_pk_\w+$/;

/** Validate and normalise (trim) an inbound publishable capture token. */
export const validateCaptureToken = (
  token: string,
): Effect.Effect<string, CaptureUnauthorizedError> => {
  const normalized = token.trim();
  if (!normalized) {
    return Effect.fail(
      new CaptureUnauthorizedError({ code: "unauthorized", error: "missing token" }),
    );
  }
  if (!TOKEN_FORMAT.test(normalized)) {
    return Effect.fail(
      new CaptureUnauthorizedError({ code: "unauthorized", error: "invalid token format" }),
    );
  }
  return Effect.succeed(normalized);
};

/** The last 4 chars of a token, used for redacted logging. */
export const tokenSuffix = (token: string): string => token.slice(-4);

/** Resolve the canonical event timestamp in priority order. */
export const resolveEventTimestamp = ({
  receivedAt,
  sentAt,
  timestamp,
}: {
  readonly sentAt?: Date;
  readonly receivedAt: Date;
  readonly timestamp?: Date;
}): Date => timestamp ?? sentAt ?? receivedAt;

/** Pick the destination lane/topic for an accepted event from policy + quota state. */
export const selectRoute = ({
  overQuota,
  policy,
}: {
  readonly overQuota: boolean;
  readonly policy: CaptureProjectPolicy;
}): Effect.Effect<RouteDecision, CaptureRateLimitedError> =>
  Effect.gen(function* () {
    const routeClass = policy.forceRoute ?? (overQuota ? "overflow" : "main");

    switch (routeClass) {
      case "main":
        return {
          isHistorical: false,
          routeClass,
          skipEnrichment: policy.skipEnrichment,
          targetTopic: CAPTURE_TOPIC_MAIN,
        };
      case "dlq":
        return {
          isHistorical: false,
          routeClass,
          skipEnrichment: policy.skipEnrichment,
          targetTopic: CAPTURE_TOPIC_DLQ,
        };
      case "overflow":
        return {
          isHistorical: false,
          routeClass,
          skipEnrichment: policy.skipEnrichment,
          targetTopic: CAPTURE_TOPIC_OVERFLOW,
        };
      case "historical":
        return {
          isHistorical: true,
          routeClass,
          skipEnrichment: policy.skipEnrichment,
          targetTopic: CAPTURE_TOPIC_HISTORICAL,
        };
      case "custom":
        // Custom topics aren't wired in the Cloudflare-native infra; reject so the
        // caller doesn't silently drop events on the floor.
        return yield* Effect.fail(
          new CaptureRateLimitedError({
            code: "rate_limited",
            error: "custom routes are not supported in this deployment",
          }),
        );
    }
  });

/** Build the wire-stable {@link CapturedEventV1} envelope for an accepted event. */
export const makeEnvelope = ({
  event,
  organizationId,
  projectId,
  receivedAt,
  request,
  route,
  sentAt,
  token,
}: {
  readonly event: typeof CaptureEvent.Type;
  readonly organizationId: string;
  readonly projectId: string;
  readonly receivedAt: Date;
  readonly request: {
    readonly clientIp?: string;
    readonly headers: Readonly<Record<string, string | undefined>>;
    readonly path?: string;
    readonly requestId: string;
  };
  readonly route: RouteDecision;
  readonly sentAt: Date;
  readonly token: string;
}): CapturedEventV1Type => {
  const timestamp = resolveEventTimestamp({ sentAt, receivedAt, timestamp: event.timestamp });
  // An explicit attribute-set (`$set`/`$set_once` via the SDK's
  // `setPersonAttributes`) is itself a reason to have a person, so the SDK
  // stamps `$process_person_profile: true` even for anonymous distinct ids.
  // Honor that client-supplied boolean when present; otherwise fall back to the
  // default (only identified ids get a person profile).
  const clientProcessPersonProfile = event.properties.$process_person_profile;
  const properties = {
    distinctId: event.distinct_id,
    properties: event.properties,
    $process_person_profile:
      typeof clientProcessPersonProfile === "boolean"
        ? clientProcessPersonProfile
        : !event.distinct_id.startsWith(ANONYMOUS_USER_ID_PREFIX),
  };
  const canonicalProperties =
    typeof request.clientIp === "string" ? { ...properties, $ip: request.clientIp } : properties;

  return {
    schemaVersion: 1,
    captureId: crypto.randomUUID(),
    ...(event.uuid ? { clientEventId: event.uuid } : {}),
    ...(event.session_id ? { sessionId: event.session_id } : {}),
    context: event.context,
    distinctId: event.distinct_id,
    event: event.event,
    eventTimestamp: timestamp.toISOString(),
    organizationId,
    projectId,
    properties: canonicalProperties,
    rawPayload: {
      context: event.context,
      distinct_id: event.distinct_id,
      event: event.event,
      properties,
      ...(event.session_id ? { session_id: event.session_id } : {}),
      ...(sentAt ? { sent_at: sentAt } : {}),
      ...(event.timestamp ? { timestamp: event.timestamp } : {}),
      ...(event.uuid ? { uuid: event.uuid } : {}),
    },
    receivedAt: receivedAt.toISOString(),
    request: {
      requestId: request.requestId,
      ...(request.path ? { path: request.path } : {}),
      ...(request.headers["user-agent"] ? { userAgent: request.headers["user-agent"] } : {}),
      ...(request.clientIp ? { clientIp: request.clientIp } : {}),
    },
    routing: route,
    token,
    sentAt: sentAt.toISOString(),
  };
};

export class EventCaptureService extends Context.Service<EventCaptureService>()(
  "EventCaptureService",
  {
    make: Effect.gen(function* () {
      const policyCounterStore = yield* PolicyCounterStore;
      const ingress = yield* CaptureIngress;
      const db = yield* Db;

      const captureEvents = Effect.fn("captureEvents")(
        function* (input: CaptureRequest) {
          const token = yield* validateCaptureToken(input.request.token);

          // Resolve the project + policy from the publishable token: look up the
          // public api key (joined to its project), then load the project's
          // capture policy (falling back to defaults), or fail unauthorized.
          const [apiKeyRecord] = yield* db
            .select({
              organizationId: projects.organizationId,
              projectId: apiKeys.projectId,
            })
            .from(apiKeys)
            .innerJoin(projects, eq(projects.id, apiKeys.projectId))
            .where(and(eq(apiKeys.isPublic, true), eq(apiKeys.key, token)))
            .limit(1);

          const result = !apiKeyRecord
            ? null
            : yield* Effect.gen(function* () {
                const [policyRecord] = yield* db
                  .select()
                  .from(captureProjectPolicies)
                  .where(eq(captureProjectPolicies.projectId, apiKeyRecord.projectId))
                  .limit(1);

                const policy: CaptureProjectPolicy = policyRecord
                  ? {
                      customTopic: policyRecord.customTopic ?? undefined,
                      eventsPerDay: policyRecord.eventsPerDay ?? undefined,
                      forceRoute: parseForceRoute(policyRecord.forceRoute),
                      ingestEnabled: policyRecord.ingestEnabled,
                      projectId: policyRecord.projectId,
                      requestsPerMinute: policyRecord.requestsPerMinute ?? undefined,
                      skipEnrichment: policyRecord.skipEnrichment,
                    }
                  : defaultCaptureProjectPolicy(apiKeyRecord.projectId);

                return {
                  organizationId: apiKeyRecord.organizationId,
                  policy,
                  projectId: apiKeyRecord.projectId,
                } satisfies ResolvedCaptureProject;
              });

          if (!result) {
            return yield* Effect.fail(
              new CaptureUnauthorizedError({ code: "unauthorized", error: "invalid token" }),
            );
          }

          const project = result;

          yield* Effect.annotateCurrentSpan("voidhash.request.id", input.request.requestId);
          yield* Effect.annotateCurrentSpan("voidhash.api_key.suffix", tokenSuffix(token));
          yield* Effect.annotateCurrentSpan("voidhash.project.id", project.projectId);
          if (project.organizationId)
            yield* Effect.annotateCurrentSpan("voidhash.organization.id", project.organizationId);

          if (!project.policy.ingestEnabled) {
            return yield* Effect.fail(
              new CaptureRateLimitedError({
                code: "rate_limited",
                error: "capture is disabled for this project",
              }),
            );
          }

          const requestLimit = yield* policyCounterStore.checkRequestLimit({
            now: input.request.receivedAt,
            projectId: project.projectId,
            requestsPerMinute: project.policy.requestsPerMinute,
          });
          if (!requestLimit.allowed) {
            return yield* Effect.fail(
              new CaptureRateLimitedError({
                code: "rate_limited",
                error: "request rate limit exceeded",
                ...(typeof requestLimit.retryAfterMs === "number"
                  ? { retry_after_ms: requestLimit.retryAfterMs }
                  : {}),
              }),
            );
          }

          const publishableEvents: Array<{
            envelope: ReturnType<typeof makeEnvelope>;
            routeClass: RouteClass;
          }> = [];
          let accepted = 0;
          let rejected = 0;

          for (const event of input.events) {
            if (isReservedRevenueEventName(event.event)) {
              rejected += 1;
              yield* Effect.logWarning(
                "rejected reserved revenue event from publishable-key capture",
                {
                  eventName: event.event,
                  projectId: project.projectId,
                  tokenSuffix: tokenSuffix(token),
                },
              );
              continue;
            }

            const outcome = yield* Effect.result(
              Effect.gen(function* () {
                // The seam to exempt specific event classes from quota. When
                // bypassed, the counter is never read and the route is never
                // forced to overflow; SDK events consume quota by default.
                const bypassQuota = shouldBypassQuota({
                  eventName: event.event,
                  trustClass: "untrusted-sdk",
                });
                const withinQuota =
                  bypassQuota ||
                  (yield* policyCounterStore
                    .checkEventQuota({
                      now: input.request.receivedAt,
                      projectId: project.projectId,
                      quota: project.policy.eventsPerDay,
                    })
                    .pipe(Effect.withSpan("policy.apply")));

                const route = yield* selectRoute({
                  overQuota: !withinQuota,
                  policy: project.policy,
                });

                const envelope = makeEnvelope({
                  event,
                  organizationId: project.organizationId,
                  projectId: project.projectId,
                  receivedAt: input.request.receivedAt,
                  request: input.request,
                  route,
                  sentAt: input.request.sentAt,
                  token,
                });

                return { envelope, routeClass: route.routeClass };
              }),
            );

            if (outcome._tag === "Failure") {
              rejected += 1;
              continue;
            }

            publishableEvents.push(outcome.success);
            accepted += 1;
          }

          yield* ingress.enqueueBatch(publishableEvents);
          yield* Effect.annotateCurrentSpan("voidhash.capture.accepted_count", accepted);
          yield* Effect.annotateCurrentSpan("voidhash.capture.rejected_count", rejected);
          yield* Effect.logInfo("capture request processed", {
            accepted,
            projectId: project.projectId,
            rejected,
            requestId: input.request.requestId,
            tokenSuffix: tokenSuffix(token),
          });

          return { accepted, rejected } satisfies CaptureResult;
        },
        (effect) =>
          effect.pipe(
            Effect.withSpan("event-capture.captureEvents"),
            Effect.catchTags({
              EffectDrizzleQueryError: (error) =>
                Effect.fail(
                  new EventCaptureServiceError({
                    cause: String(error.cause),
                    message: "capture project lookup failed",
                  }),
                ),
              PolicyStoreError: (error) =>
                Effect.fail(
                  new EventCaptureServiceError({
                    cause: String(error.cause ?? error.message),
                    message: error.message,
                  }),
                ),
              CaptureIngressError: (error) =>
                Effect.fail(
                  new EventCaptureServiceError({
                    cause: String(error.cause ?? error.message),
                    message: error.message,
                  }),
                ),
            }),
          ),
      );

      return { captureEvents } as const;
    }),
  },
) {
  static readonly layer: Layer.Layer<
    EventCaptureService,
    never,
    Db | PolicyCounterStore | CaptureIngress
  > = Layer.effect(EventCaptureService)(EventCaptureService.make);
}
