import {
  CaptureRateLimitedError,
  CaptureUnauthorizedError,
  type CaptureEvent,
} from "@voidhash/api-contracts/event-capture";
import { and, apiKeys, captureProjectPolicies, Db, eq, projects } from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Context, Effect, Layer, Schema } from "effect";

import {
  analyticsEventFromCapture,
  isCommunityCaptureEventName,
} from "../../domain/analytics/AnalyticsEvent.ts";
import { AnalyticsEventStore } from "../analytics/AnalyticsEventStore.ts";

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

export interface EventCaptureServiceShape {
  readonly captureEvents: (
    input: CaptureRequest,
  ) => Effect.Effect<
    CaptureResult,
    EventCaptureServiceError | CaptureRateLimitedError | CaptureUnauthorizedError,
    PlatformRuntime
  >;
}

const TOKEN_FORMAT = /^vh_pk_\w+$/;

/** Validate and normalize an inbound publishable capture token. */
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

/** The last four token characters, safe for request diagnostics. */
export const tokenSuffix = (token: string): string => token.slice(-4);

/** Resolve the canonical event timestamp in capture priority order. */
export const resolveEventTimestamp = (input: {
  readonly receivedAt: Date;
  readonly sentAt?: Date;
  readonly timestamp?: Date;
}): Date => input.timestamp ?? input.sentAt ?? input.receivedAt;

const makeEventCaptureService = Effect.gen(function* () {
  const db = yield* Db;
  const eventStore = yield* AnalyticsEventStore;

  const captureEvents = Effect.fn("captureEvents")(
    function* (input: CaptureRequest) {
      const token = yield* validateCaptureToken(input.request.token);
      const [apiKeyRecord] = yield* db
        .select({
          organizationId: projects.organizationId,
          projectId: apiKeys.projectId,
        })
        .from(apiKeys)
        .innerJoin(projects, eq(projects.id, apiKeys.projectId))
        .where(and(eq(apiKeys.isPublic, true), eq(apiKeys.key, token)))
        .limit(1);

      if (!apiKeyRecord) {
        return yield* Effect.fail(
          new CaptureUnauthorizedError({ code: "unauthorized", error: "invalid token" }),
        );
      }

      const [policy] = yield* db
        .select({ ingestEnabled: captureProjectPolicies.ingestEnabled })
        .from(captureProjectPolicies)
        .where(eq(captureProjectPolicies.projectId, apiKeyRecord.projectId))
        .limit(1);

      if (policy?.ingestEnabled === false) {
        return yield* Effect.fail(
          new CaptureRateLimitedError({
            code: "rate_limited",
            error: "capture is disabled for this project",
          }),
        );
      }

      const supported = input.events.filter((event) => isCommunityCaptureEventName(event.event));
      const records = supported.map((event) =>
        analyticsEventFromCapture({
          event,
          organizationId: apiKeyRecord.organizationId,
          projectId: apiKeyRecord.projectId,
          receivedAt: input.request.receivedAt,
          requestId: input.request.requestId,
          requestPath: input.request.path,
          sentAt: input.request.sentAt,
          token,
        }),
      );

      yield* eventStore.insert(records);
      const result = {
        accepted: supported.length,
        rejected: input.events.length - supported.length,
      } satisfies CaptureResult;

      yield* Effect.logInfo("capture request processed", {
        ...result,
        projectId: apiKeyRecord.projectId,
        requestId: input.request.requestId,
        tokenSuffix: tokenSuffix(token),
      });
      return result;
    },
    (effect) =>
      effect.pipe(
        Effect.withSpan("event-capture.captureEvents"),
        Effect.catchTags({
          AnalyticsEventStoreError: (error) =>
            Effect.fail(
              new EventCaptureServiceError({ cause: error.cause, message: error.message }),
            ),
          EffectDrizzleQueryError: (error) =>
            Effect.fail(
              new EventCaptureServiceError({
                cause: String(error.cause),
                message: "capture project lookup failed",
              }),
            ),
        }),
      ),
  );

  return constant({ captureEvents }) satisfies EventCaptureServiceShape;
});

/**
 * Community capture implementation. It accepts only the built-in lifecycle
 * events and inserts them synchronously into PostgreSQL. Unsupported and
 * custom events are intentionally counted as rejected without entering a
 * queue, workflow, identity processor, or dead-letter path.
 */
export class EventCaptureService extends Context.Service<
  EventCaptureService,
  EventCaptureServiceShape
>()("EventCaptureService") {
  static readonly layer: Layer.Layer<EventCaptureService, never, Db | AnalyticsEventStore> =
    Layer.effect(EventCaptureService)(makeEventCaptureService);
}
