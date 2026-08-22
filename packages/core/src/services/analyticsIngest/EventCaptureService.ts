import {
  CaptureRateLimitedError,
  CaptureUnauthorizedError,
  type CaptureEvent,
} from "@voidhash/api-contracts/event-capture";
import { and, apiKeys, captureProjectPolicies, Db, eq, projects } from "@voidhash/db";
import { constant } from "@voidhash/lib/lang";
import type { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Context, Effect, Layer, Schema } from "effect";

import { analyticsEventFromCapture } from "../../domain/analytics/AnalyticsEvent.ts";
import {
  admitEvent,
  emptyEventAdmissionPolicy,
  type EventAdmissionPolicy,
} from "../../domain/analytics/EventAdmission.ts";
import { isReservedRevenueEventName } from "../../domain/internalAnalytics/InternalAnalyticsEvents.ts";
import { hashKey } from "../apiKeys/api-keys.ts";
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

const PUBLISHABLE_TOKEN_FORMAT = /^vh_pk_\w+$/;
const SECRET_TOKEN_FORMAT = /^vh_sk_\w+$/;

/**
 * A capture credential resolved to the shape needed to look it up in `api_key`.
 *
 * Publishable keys are stored verbatim, so `lookupKey` is the token itself.
 * Secret keys are stored as a SHA-256 digest, so `lookupKey` is that digest —
 * which is also the value persisted on the analytics event, keeping the raw
 * secret out of the events table.
 */
export interface CaptureCredential {
  readonly isPublic: boolean;
  readonly lookupKey: string;
}

/** Validate and normalize an inbound capture token. */
export const validateCaptureToken = (
  token: string,
): Effect.Effect<string, CaptureUnauthorizedError> => {
  const normalized = token.trim();
  if (!normalized) {
    return Effect.fail(
      new CaptureUnauthorizedError({ code: "unauthorized", error: "missing token" }),
    );
  }
  if (!PUBLISHABLE_TOKEN_FORMAT.test(normalized) && !SECRET_TOKEN_FORMAT.test(normalized)) {
    return Effect.fail(
      new CaptureUnauthorizedError({ code: "unauthorized", error: "invalid token format" }),
    );
  }
  return Effect.succeed(normalized);
};

/**
 * Resolve a validated capture token into its `api_key` lookup form.
 *
 * Accepting a project secret key here is what lets the server-side SDKs (node,
 * go, rust, php) ship with a single credential instead of also requiring a
 * publishable key they have no other use for.
 */
export const resolveCaptureCredential = (
  token: string,
): Effect.Effect<CaptureCredential, CaptureUnauthorizedError> =>
  Effect.gen(function* () {
    const normalized = yield* validateCaptureToken(token);
    if (PUBLISHABLE_TOKEN_FORMAT.test(normalized)) {
      return { isPublic: true, lookupKey: normalized };
    }
    return { isPublic: false, lookupKey: yield* hashKey(normalized) };
  });

/**
 * Whether a raw capture credential is a project secret key (`vh_sk_...`).
 *
 * The HTTP routes use this to reject a secret key presented in the body
 * `token` field: that field is what distributed clients ship, so accepting a
 * secret there would let a misconfigured client keep exposing it without the
 * failure ever surfacing.
 */
export const isSecretCaptureToken = (token: string): boolean =>
  SECRET_TOKEN_FORMAT.test(token.trim());

/**
 * Whether an already-resolved lookup key is a verbatim publishable key rather
 * than a secret-key digest.
 *
 * Captured-event envelopes carry {@link CaptureCredential.lookupKey} as their
 * `token`, so downstream consumers (the event processor) use this to mirror
 * the ingress `api_key` lookup: verbatim key on an `isPublic` row for
 * publishable tokens, digest on a non-public row for secret keys.
 */
export const isPublishableLookupKey = (lookupKey: string): boolean =>
  PUBLISHABLE_TOKEN_FORMAT.test(lookupKey);

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
      const credential = yield* resolveCaptureCredential(input.request.token);
      const [apiKeyRecord] = yield* db
        .select({
          organizationId: projects.organizationId,
          projectId: apiKeys.projectId,
        })
        .from(apiKeys)
        .innerJoin(projects, eq(projects.id, apiKeys.projectId))
        .where(and(eq(apiKeys.isPublic, credential.isPublic), eq(apiKeys.key, credential.lookupKey)))
        .limit(1);

      if (!apiKeyRecord) {
        return yield* Effect.fail(
          new CaptureUnauthorizedError({ code: "unauthorized", error: "invalid token" }),
        );
      }

      const [policy] = yield* db
        .select({
          builtinEventOverrides: captureProjectPolicies.builtinEventOverrides,
          customEventBlocklist: captureProjectPolicies.customEventBlocklist,
          ingestEnabled: captureProjectPolicies.ingestEnabled,
        })
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

      const admissionPolicy: EventAdmissionPolicy = policy ?? emptyEventAdmissionPolicy;

      // Revenue events are server-trusted: they are minted from verified store
      // receipts, so no capture credential — publishable or secret — may forge
      // one, even when the project has the revenue group enabled.
      const supported = input.events.filter(
        (event) =>
          !isReservedRevenueEventName(event.event) &&
          admitEvent({ edition: "oss", eventName: event.event, policy: admissionPolicy }).admitted,
      );
      const records = supported.map((event) =>
        analyticsEventFromCapture({
          event,
          organizationId: apiKeyRecord.organizationId,
          projectId: apiKeyRecord.projectId,
          receivedAt: input.request.receivedAt,
          requestId: input.request.requestId,
          requestPath: input.request.path,
          sentAt: input.request.sentAt,
          token: credential.lookupKey,
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
        tokenSuffix: tokenSuffix(credential.lookupKey),
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
 * Community capture implementation. Admission is decided by the project's
 * event-admission policy (see `domain/analytics/EventAdmission.ts`) and admitted
 * events are inserted synchronously into PostgreSQL. Rejected events are counted
 * without entering a queue, workflow, identity processor, or dead-letter path.
 */
export class EventCaptureService extends Context.Service<
  EventCaptureService,
  EventCaptureServiceShape
>()("EventCaptureService") {
  static readonly layer: Layer.Layer<EventCaptureService, never, Db | AnalyticsEventStore> =
    Layer.effect(EventCaptureService)(makeEventCaptureService);
}
