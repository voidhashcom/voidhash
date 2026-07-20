/**
 * HTTP route handlers for the analytics-ingest event-capture endpoints (`/i/*`),
 * served by the Cloudflare-native backend worker (the former standalone
 * AnalyticsPipelineWorker was merged into it).
 *
 * The capture business logic lives in {@link EventCaptureService} (which
 * already encapsulates token validation, policy enforcement, route selection,
 * and queue publication). This file is responsible for HTTP-shape concerns
 * only: request-id minting, client-IP extraction, response shaping, and error
 * mapping at the wire boundary.
 *
 * Mirrors `internal/apps/event-capture/src/http/routes.ts` line-for-line in
 * intent; the only deltas are the Cloudflare-native client-IP extraction
 * (`CF-Connecting-IP`) and the absence of a `/i/ready` route (Cloudflare
 * Workers don't have a startup-readiness check the way Bun servers do).
 */
import {
  CaptureAcceptedResponse,
  CaptureDependencyUnavailableError,
  CaptureInternalServerError,
  CaptureRateLimitedError,
  CaptureRejectedRecord,
  EventCaptureApi,
  MeasurementDeletionAcceptedResponse,
  ProtectedEvidenceAcceptedResponse,
} from "@voidhash/api-contracts/event-capture";
import { EventCaptureService } from "@voidhash/core/services/analyticsIngest/EventCaptureService";
import { MeasurementConfigurationService } from "@voidhash/core/services/measurement/MeasurementConfigurationService";
import { MeasurementDeletionService } from "@voidhash/core/services/measurement/MeasurementDeletionService";
import { ProtectedEvidenceService } from "@voidhash/core/services/measurement/ProtectedEvidenceService";
import { Effect } from "effect";
import * as HttpEffect from "effect/unstable/http/HttpEffect";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

/**
 * Extract the originating client IP from the request headers. Cloudflare
 * always populates `cf-connecting-ip`; the `x-forwarded-for` fallback only
 * matters for local `wrangler dev` requests.
 */
const extractClientIp = (
  headers: Readonly<Record<string, string | undefined>>,
): string | undefined => {
  const cfIp = headers["cf-connecting-ip"]?.trim();
  if (cfIp) return cfIp;

  const forwardedFor = headers["x-forwarded-for"]?.split(",")[0]?.trim();
  return forwardedFor || undefined;
};

const appendRequestIdHeader = (requestId: string) =>
  HttpEffect.appendPreResponseHandler((_req, response) =>
    Effect.succeed(HttpServerResponse.setHeader(response, "x-request-id", requestId)),
  );

const appendRetryAfterHeader = (retryAfterMs: number) =>
  HttpEffect.appendPreResponseHandler((_req, response) =>
    Effect.succeed(
      HttpServerResponse.setHeader(response, "retry-after", String(Math.ceil(retryAfterMs / 1000))),
    ),
  );

export const EventCaptureGroupLive = HttpApiBuilder.group(
  EventCaptureApi,
  "event_capture",
  (handlers) =>
    Effect.gen(function* () {
      const captureService = yield* EventCaptureService;
      const configurationService = yield* MeasurementConfigurationService;
      const deletionService = yield* MeasurementDeletionService;
      const protectedEvidenceService = yield* ProtectedEvidenceService;
      return handlers
        .handle("capture", ({ request, payload }) =>
          Effect.gen(function* () {
            const requestId = `req_${crypto.randomUUID()}`;
            yield* appendRequestIdHeader(requestId);

            const result = yield* captureService
              .captureEvents({
                events: [payload],
                request: {
                  clientIp: extractClientIp(request.headers),
                  path: "/i/v1/capture",
                  receivedAt: new Date(),
                  sentAt: payload.sent_at,
                  token: payload.token,
                  headers: request.headers,
                  requestId,
                },
              })
              .pipe(
                Effect.catchTag("CaptureRateLimitedError", (error) =>
                  Effect.gen(function* () {
                    if (typeof error.retry_after_ms === "number") {
                      yield* appendRetryAfterHeader(error.retry_after_ms);
                    }
                    return yield* Effect.fail(
                      new CaptureRateLimitedError({
                        code: error.code,
                        error: error.error,
                      }),
                    );
                  }),
                ),
                Effect.catchTag("EventCaptureServiceError", () =>
                  Effect.fail(
                    new CaptureDependencyUnavailableError({
                      code: "dependency_unavailable",
                      error: "capture dependency is unavailable",
                    }),
                  ),
                ),
                Effect.catchDefect(() =>
                  Effect.fail(
                    new CaptureInternalServerError({
                      code: "internal_error",
                      error: "internal server error",
                    }),
                  ),
                ),
              );

            return new CaptureAcceptedResponse({
              accepted: result.accepted,
              rejected: result.rejected.map((record) =>
                new CaptureRejectedRecord(record),
              ),
            });
          }),
        )
        .handle("batch", ({ request, payload }) =>
          Effect.gen(function* () {
            const requestId = `req_${crypto.randomUUID()}`;
            yield* appendRequestIdHeader(requestId);

            const result = yield* captureService
              .captureEvents({
                events: payload.events,
                request: {
                  clientIp: extractClientIp(request.headers),
                  path: "/i/v1/batch",
                  receivedAt: new Date(),
                  sentAt: payload.sent_at,
                  token: payload.token,
                  headers: request.headers,
                  requestId,
                },
              })
              .pipe(
                Effect.catchTag("CaptureRateLimitedError", (error) =>
                  Effect.gen(function* () {
                    if (typeof error.retry_after_ms === "number") {
                      yield* appendRetryAfterHeader(error.retry_after_ms);
                    }
                    return yield* Effect.fail(
                      new CaptureRateLimitedError({
                        code: error.code,
                        error: error.error,
                      }),
                    );
                  }),
                ),
                Effect.catchTag("EventCaptureServiceError", () =>
                  Effect.fail(
                    new CaptureDependencyUnavailableError({
                      code: "dependency_unavailable",
                      error: "capture dependency is unavailable",
                    }),
                  ),
                ),
                Effect.catchDefect(() =>
                  Effect.fail(
                    new CaptureInternalServerError({
                      code: "internal_error",
                      error: "internal server error",
                    }),
                  ),
                ),
              );

            return new CaptureAcceptedResponse({
              accepted: result.accepted,
              rejected: result.rejected.map((record) =>
                new CaptureRejectedRecord(record),
              ),
            });
          }),
        )
        .handle("protected", ({ payload }) =>
          protectedEvidenceService.put(payload).pipe(
            Effect.map(
              (result) =>
                new ProtectedEvidenceAcceptedResponse({
                  accepted: true,
                  blobId: result.blobId,
                }),
            ),
            Effect.catchTag("EffectDrizzleQueryError", () =>
              Effect.fail(
                new CaptureDependencyUnavailableError({
                  code: "dependency_unavailable",
                  error: "protected evidence dependency is unavailable",
                }),
              ),
            ),
            Effect.catchDefect(() =>
              Effect.fail(
                new CaptureInternalServerError({
                  code: "internal_error",
                  error: "internal server error",
                }),
              ),
            ),
          ),
        )
        .handle("deleteMeasurementData", ({ payload }) =>
          deletionService.request(payload).pipe(
            Effect.map(
              (result) =>
                new MeasurementDeletionAcceptedResponse({
                  accepted: true,
                  deletedProtectedEvidence: result.deletedProtectedEvidence,
                  requestId: result.requestId,
                  status: "completed",
                }),
            ),
            Effect.catchTag("EffectDrizzleQueryError", () =>
              Effect.fail(
                new CaptureDependencyUnavailableError({
                  code: "dependency_unavailable",
                  error: "measurement deletion dependency is unavailable",
                }),
              ),
            ),
            Effect.catchTag("SqlError", () =>
              Effect.fail(
                new CaptureDependencyUnavailableError({
                  code: "dependency_unavailable",
                  error: "measurement deletion dependency is unavailable",
                }),
              ),
            ),
            Effect.catchDefect(() =>
              Effect.fail(
                new CaptureInternalServerError({
                  code: "internal_error",
                  error: "internal server error",
                }),
              ),
            ),
          ),
        )
        .handle("getMeasurementConfiguration", ({ headers }) =>
          configurationService.get(headers["x-publishable-key"]).pipe(
            Effect.catchTag("MeasurementConfigSigningError", () =>
              Effect.fail(
                new CaptureDependencyUnavailableError({
                  code: "dependency_unavailable",
                  error: "measurement configuration signing is unavailable",
                }),
              ),
            ),
            Effect.catchTag("EffectDrizzleQueryError", () =>
              Effect.fail(
                new CaptureDependencyUnavailableError({
                  code: "dependency_unavailable",
                  error: "measurement configuration dependency is unavailable",
                }),
              ),
            ),
            Effect.catchDefect(() =>
              Effect.fail(
                new CaptureInternalServerError({
                  code: "internal_error",
                  error: "internal server error",
                }),
              ),
            ),
          ),
        );
    }),
);
