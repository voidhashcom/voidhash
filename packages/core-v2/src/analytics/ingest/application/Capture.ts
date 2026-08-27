import {
  CaptureRateLimitedError,
  CaptureUnauthorizedError,
  CaptureEvent,
} from "@voidhash/api-contracts/event-capture";
import { Context, Crypto, Effect, Encoding, Layer, Schema } from "effect";

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

/** Result returned after a capture batch has been admitted and delivered. */
export const CaptureResult = Schema.Struct({
  accepted: Schema.Int,
  rejected: Schema.Int,
});

const PUBLISHABLE_TOKEN_FORMAT = /^vh_pk_\w+$/;
const SECRET_TOKEN_FORMAT = /^vh_sk_\w+$/;

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
    if (typeof processPersonProfile !== "boolean") {
      processPersonProfile = !input.event.distinct_id.startsWith("vh:anon:");
    }
    const properties = {
      distinctId: input.event.distinct_id,
      properties: input.event.properties,
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
      properties: {
        ...properties,
        ...(input.request.clientIp && { $ip: input.request.clientIp }),
      },
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

const makeAnalyticsCapture = Effect.gen(function* () {
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
          lookupKey = yield* crypto.digest("SHA-256", new TextEncoder().encode(token)).pipe(
            Effect.map(Encoding.encodeBase64Url),
            Effect.mapError(
              (error) =>
                new AnalyticsCaptureError({ cause: String(error.cause), message: error.message }),
            ),
          );
        }
        const credential = { isPublic, lookupKey };
        const project = yield* credentials
          .resolve(credential)
          .pipe(
            Effect.mapError(
              (error) =>
                new AnalyticsCaptureError({ cause: String(error.cause), message: error.message }),
            ),
          );
        if (!project) {
          return yield* new CaptureUnauthorizedError({
            code: "unauthorized",
            error: "invalid token",
          });
        }
        if (!project.policy.ingestEnabled) {
          return yield* new CaptureRateLimitedError({
            code: "rate_limited",
            error: "capture is disabled for this project",
          });
        }
        const requestLimit = yield* counters
          .checkRequest({
            now: request.request.receivedAt,
            projectId: project.projectId,
            requestsPerMinute: project.policy.requestsPerMinute,
          })
          .pipe(
            Effect.mapError(
              (error) =>
                new AnalyticsCaptureError({ cause: String(error.cause), message: error.message }),
            ),
          );
        if (!requestLimit.allowed) {
          return yield* new CaptureRateLimitedError({
            code: "rate_limited",
            error: "request rate limit exceeded",
            ...(requestLimit.retryAfterMs !== undefined && {
              retry_after_ms: requestLimit.retryAfterMs,
            }),
          });
        }

        const envelopes: (typeof CapturedEventV1.Type)[] = [];
        for (const event of request.events) {
          if (isReservedRevenueEventName(event.event)) continue;
          if (
            !admitEvent({
              edition: config.edition,
              eventName: event.event,
              policy: project.policy.admission,
            }).admitted
          ) {
            continue;
          }
          const withinQuota =
            shouldBypassQuota({ eventName: event.event, trustClass: "untrusted-sdk" }) ||
            (yield* counters
              .checkEvent({
                now: request.request.receivedAt,
                projectId: project.projectId,
                eventsPerDay: project.policy.eventsPerDay,
              })
              .pipe(
                Effect.mapError(
                  (error) =>
                    new AnalyticsCaptureError({
                      cause: String(error.cause),
                      message: error.message,
                    }),
                ),
              ));
          if (!withinQuota) continue;
          envelopes.push(
            yield* makeCaptureEnvelope({
              event,
              organizationId: project.organizationId,
              projectId: project.projectId,
              receivedAt: request.request.receivedAt,
              request: request.request,
              token: credential.lookupKey,
            }).pipe(
              Effect.provideService(Crypto.Crypto, crypto),
              Effect.mapError(
                (error) =>
                  new AnalyticsCaptureError({ cause: String(error.cause), message: error.message }),
              ),
            ),
          );
        }
        yield* delivery
          .deliver(envelopes)
          .pipe(
            Effect.mapError(
              (error) =>
                new AnalyticsCaptureError({ cause: String(error.cause), message: error.message }),
            ),
          );
        return { accepted: envelopes.length, rejected: request.events.length - envelopes.length };
      }),
  } satisfies AnalyticsCaptureShape;
});

/** Capture use case whose implementation dependencies are supplied by layers. */
export class AnalyticsCapture extends Context.Service<AnalyticsCapture, AnalyticsCaptureShape>()(
  "@voidhash/core-v2/analytics/AnalyticsCapture",
  { make: makeAnalyticsCapture },
) {
  /** Layer constructor that leaves all implementation dependencies explicit. */
  static readonly layer = Layer.effect(AnalyticsCapture)(AnalyticsCapture.make);
}
