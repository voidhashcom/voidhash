import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import {
  CaptureRateLimitedError,
  CaptureUnauthorizedError,
  CaptureEvent,
} from "@voidhash/api-contracts/event-capture";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import {
  isReservedRevenueEventName,
  shouldBypassQuota,
} from "../../domain/InternalAnalyticsEvents.ts";
import {
  AnalyticsConfig,
  AnalyticsDelivery,
  CaptureCredentialRepository,
  PolicyCounter,
} from "../../application/ports.ts";
import { admitEvent } from "../domain/EventAdmission.ts";
import type { CapturedEventV1 } from "../domain/Ingest.ts";

export class AnalyticsCaptureError extends Schema.TaggedErrorClass<AnalyticsCaptureError>(
  "AnalyticsCaptureError",
)("AnalyticsCaptureError", {
  cause: Schema.String,
  message: Schema.String,
}) {}

const captureError = (error: { readonly cause?: unknown; readonly message: string }) =>
  new AnalyticsCaptureError({ cause: String(error.cause), message: error.message });

/** Decoded request accepted by the analytics capture application service. */
export const CaptureRequest = Schema.Struct({
  request: Schema.Struct({
    path: Schema.optional(Schema.String),
    token: Schema.String,
    sentAt: Schema.Date,
    receivedAt: Schema.Date,
    clientIp: Schema.optional(Schema.String),
    requestId: Schema.String,
    headers: Schema.Record(Schema.String, Schema.UndefinedOr(Schema.String)),
  }),
  events: Schema.Array(CaptureEvent),
});
export type CaptureRequest = typeof CaptureRequest.Type;

/** Result returned after a capture batch has been admitted and delivered. */
export const CaptureResult = Schema.Struct({
  accepted: Schema.Int,
  rejected: Schema.Int,
});
export type CaptureResult = typeof CaptureResult.Type;

const PUBLISHABLE_TOKEN_FORMAT = /^vh_pk_\w+$/;
const SECRET_TOKEN_FORMAT = /^vh_sk_\w+$/;
/** Upper bound on events per capture request; one request cannot be arbitrarily large. */
const MAX_CAPTURE_EVENTS = 100;

const makeCaptureEnvelope = (input: {
  readonly event: typeof CaptureEvent.Type;
  readonly organizationId: string;
  readonly projectId: string;
  readonly receivedAt: Date;
  readonly request: (typeof CaptureRequest.Type)["request"];
  readonly token: string;
}) =>
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    let processPersonProfile = input.event.properties.$process_person_profile;
    if (!P.isBoolean(processPersonProfile)) {
      processPersonProfile = !input.event.distinct_id.startsWith("vh:anon:");
    }
    // Server-derived enrichment rides inside the user properties object so it
    // survives the unwrap-to-inner step at storage time.
    const innerProperties = {
      ...input.event.properties,
      ...(input.request.headers["user-agent"] && {
        $user_agent: input.request.headers["user-agent"],
      }),
      ...(input.request.clientIp && { $ip: input.request.clientIp }),
    };
    const properties = {
      distinctId: input.event.distinct_id,
      properties: innerProperties,
      $process_person_profile: processPersonProfile,
    };
    return {
      schemaVersion: 1,
      captureId: `cap_${yield* crypto.randomUUIDv4}`,
      ...(input.event.uuid && { clientEventId: input.event.uuid }),
      ...(input.event.session_id && { sessionId: input.event.session_id }),
      context: input.event.context,
      distinctId: input.event.distinct_id,
      event: input.event.event,
      eventTimestamp: input.event.timestamp.toISOString(),
      organizationId: input.organizationId,
      projectId: input.projectId,
      properties,
      rawPayload: {
        context: input.event.context,
        distinct_id: input.event.distinct_id,
        event: input.event.event,
        properties,
        ...(input.event.session_id && { session_id: input.event.session_id }),
        timestamp: input.event.timestamp,
        ...(input.event.uuid && { uuid: input.event.uuid }),
      },
      receivedAt: input.receivedAt.toISOString(),
      request: {
        requestId: input.request.requestId,
        ...(input.request.path && { path: input.request.path }),
        ...(input.request.headers["user-agent"] && {
          userAgent: input.request.headers["user-agent"],
        }),
        ...(input.request.clientIp && { clientIp: input.request.clientIp }),
      },
      sentAt: input.request.sentAt.toISOString(),
      sourceTopic: "analytics.ingest.v1",
      token: input.token,
      trustClass: "untrusted-sdk",
    } satisfies typeof CapturedEventV1.Type;
  });

/** Capture application capabilities. */
export interface AnalyticsCaptureShape {
  readonly capture: (
    input: typeof CaptureRequest.Type,
  ) => Effect.Effect<
    typeof CaptureResult.Type,
    AnalyticsCaptureError | CaptureRateLimitedError | CaptureUnauthorizedError
  >;
}

const makeAnalyticsCapture = Effect.fn("makeAnalyticsCapture")(function* () {
  const config = yield* AnalyticsConfig;
  const credentials = yield* CaptureCredentialRepository;
  const counters = yield* PolicyCounter;
  const delivery = yield* AnalyticsDelivery;
  const crypto = yield* Crypto.Crypto;

  return {
    capture: (request: typeof CaptureRequest.Type) =>
      Effect.gen(function* () {
        const token = request.request.token.trim();
        if (!token) {
          return yield* new CaptureUnauthorizedError({
            code: "unauthorized",
            error: "missing token",
          });
        }
        if (!PUBLISHABLE_TOKEN_FORMAT.test(token) && !SECRET_TOKEN_FORMAT.test(token)) {
          return yield* new CaptureUnauthorizedError({
            code: "unauthorized",
            error: "invalid token format",
          });
        }
        const isPublic = PUBLISHABLE_TOKEN_FORMAT.test(token);
        let lookupKey = token;
        if (!isPublic) {
          lookupKey = yield* crypto
            .digest("SHA-256", new TextEncoder().encode(token))
            .pipe(Effect.map(Encoding.encodeBase64Url), Effect.mapError(captureError));
        }
        const credential = { isPublic, lookupKey };
        const project = yield* credentials.resolve(credential).pipe(Effect.mapError(captureError));
        if (!project) {
          return yield* new CaptureUnauthorizedError({
            code: "unauthorized",
            error: "invalid token",
          });
        }
        if (!project.policy.isIngestEnabled) {
          return yield* new CaptureRateLimitedError({
            code: "rate_limited",
            error: "capture is disabled for this project",
          });
        }
        if (request.events.length > MAX_CAPTURE_EVENTS) {
          return yield* new CaptureRateLimitedError({
            code: "rate_limited",
            error: `request exceeds the maximum of ${MAX_CAPTURE_EVENTS} events`,
          });
        }
        const requestLimit = yield* counters
          .checkRequest({
            now: request.request.receivedAt,
            projectId: project.projectId,
            requestsPerMinute: project.policy.requestsPerMinute,
          })
          .pipe(Effect.mapError(captureError));
        if (!requestLimit.allowed) {
          return yield* new CaptureRateLimitedError({
            code: "rate_limited",
            error: "request rate limit exceeded",
            ...(requestLimit.retryAfterMs !== undefined && {
              retry_after_ms: requestLimit.retryAfterMs,
            }),
          });
        }

        const admitted = Arr.getSomes(
          yield* Effect.forEach(request.events, (event) => {
          if (isReservedRevenueEventName(event.event)) return Effect.succeed(Option.none());
          if (
            !admitEvent({
              edition: config.edition,
              eventName: event.event,
              policy: project.policy.admission,
            }).admitted
          ) {
            return Effect.succeed(Option.none());
          }
          return makeCaptureEnvelope({
              event,
              organizationId: project.organizationId,
              projectId: project.projectId,
              receivedAt: request.request.receivedAt,
              request: request.request,
              token: credential.lookupKey,
            }).pipe(
              Effect.provideService(Crypto.Crypto, crypto),
              Effect.mapError(captureError),
              Effect.map((envelope) =>
                Option.some({
                  envelope,
                  quotaExempt: shouldBypassQuota({
                    eventName: event.event,
                    trustClass: "untrusted-sdk",
                  }),
                }),
              ),
            );
          }, { concurrency: 1 }),
        );
        const reservation = yield* counters
          .reserveEvents({
            count: admitted.filter((candidate) => !candidate.quotaExempt).length,
            now: request.request.receivedAt,
            projectId: project.projectId,
            eventsPerDay: project.policy.eventsPerDay,
          })
          .pipe(Effect.mapError(captureError));
        let quotaRemaining = reservation.reserved;
        const envelopes = admitted.flatMap((candidate) => {
          if (candidate.quotaExempt) return [candidate.envelope];
          if (quotaRemaining < 1) return [];
          quotaRemaining -= 1;
          return [candidate.envelope];
        });
        const deliveryResult = yield* Effect.result(delivery.deliver(envelopes));
        return yield* Result.match(deliveryResult, {
          onFailure: (failure) =>
            reservation
              .commit(Math.min(failure.stored, reservation.reserved))
              .pipe(
                Effect.catch(() => Effect.void),
                Effect.flatMap(() => Effect.fail(captureError(failure))),
              ),
          onSuccess: (outcome) =>
            reservation
              .commit(Math.min(outcome.stored, reservation.reserved))
              .pipe(
                Effect.mapError(captureError),
                Effect.as({
                  accepted: outcome.stored,
                  rejected: request.events.length - outcome.stored,
                }),
              ),
        });
      }),
  } satisfies AnalyticsCaptureShape;
})();

/** Capture use case whose implementation dependencies are supplied by layers. */
export class AnalyticsCapture extends Context.Service<AnalyticsCapture, AnalyticsCaptureShape>()(
  "@voidhash/core-v2/analytics/AnalyticsCapture",
  { make: makeAnalyticsCapture },
) {
  /** Layer constructor that leaves all implementation dependencies explicit. */
  static readonly layer = Layer.effect(AnalyticsCapture)(AnalyticsCapture.make);
}
