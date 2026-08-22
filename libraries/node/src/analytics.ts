import { make as makeEventCaptureClient } from "@voidhash/generated-clients/event-capture";
import { DateTime, Effect } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";

import { VoidhashNodeConfigurationError } from "./errors";
import type { VoidhashNodeClientOptions } from "./types";

export const DEFAULT_INGEST_URL = "https://ingest.voidhash.com";

// oxlint-disable-next-line effect/noGlobals -- this SDK is the Node platform adapter and already
// requires `globalThis.fetch` at construction; Effect ships no default `Crypto` layer, so reaching
// for the same Web Crypto global here is the platform-appropriate source of the event id rather
// than making every consumer provide a layer for one UUID.
const newEventId = (): string => globalThis.crypto.randomUUID();

type EffectError<TEffect> =
  TEffect extends Effect.Effect<infer _Success, infer Error, infer _Requirements> ? Error : never;

type EventCaptureClient = ReturnType<typeof makeEventCaptureClient>;

type CaptureEffect = ReturnType<EventCaptureClient["eventCaptureCapture"]>;

type CaptureError = EffectError<CaptureEffect> | VoidhashNodeConfigurationError;

/** How ingest handled a request: how many events it took and how many it discarded. */
export type VoidhashCaptureResult = {
  readonly accepted: number;
  readonly rejected: number;
};

export type CaptureRequest = {
  /** Event name, for example `note_created`. */
  readonly event: string;
  /** The person the event belongs to. */
  readonly distinctId: string;
  /**
   * The event's own attributes. Facts about the person belong in person
   * attributes (`persons.setAttributes`) instead, so they are not repeated on
   * every event.
   */
  readonly properties?: Record<string, unknown> | undefined;
  /** The sending environment. Optional. */
  readonly context?: Record<string, unknown> | undefined;
  /** When the event occurred. Defaults to when it is sent. */
  readonly timestamp?: Date | undefined;
};

export type VoidhashAnalyticsEffectNamespace = {
  readonly capture: (request: CaptureRequest) => Effect.Effect<VoidhashCaptureResult, CaptureError>;
};

/**
 * `timestamp` is optional on the wire and must be absent rather than `null`
 * when the caller did not supply one.
 */
const timestampPatch = (timestamp: Date | undefined): { timestamp?: string } => {
  if (timestamp === undefined) {
    return {};
  }
  return { timestamp: timestamp.toISOString() };
};

const resolveIngestUrl = (
  ingestUrl: string | undefined,
): Effect.Effect<string, VoidhashNodeConfigurationError> =>
  Effect.gen(function* () {
    const resolved = yield* Effect.try({
      try: () => new URL(ingestUrl ?? DEFAULT_INGEST_URL),
      catch: (cause) => new VoidhashNodeConfigurationError("ingestUrl must be a valid URL.", { cause }),
    });

    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return yield* Effect.fail(
        new VoidhashNodeConfigurationError("ingestUrl must use the http or https protocol."),
      );
    }

    return resolved.toString();
  });

/**
 * Builds the analytics namespace.
 *
 * Event capture is the one surface that does not use the secret key: ingest is
 * the same endpoint the browser and mobile SDKs post to, and it authenticates
 * on the project's **publishable** key carried in the request body. It also
 * lives on its own origin, so this deliberately does not reuse the management
 * client's transport — a secret key has no business being sent there.
 */
export const makeAnalytics = (options: VoidhashNodeClientOptions): VoidhashAnalyticsEffectNamespace => {
  const publishableKey = options.publishableKey?.trim();

  const client = Effect.runSync(
    Effect.gen(function* () {
      const ingestUrl = yield* resolveIngestUrl(options.ingestUrl);
      const httpClient = yield* HttpClient.HttpClient;
      return makeEventCaptureClient(httpClient, {
        transformClient: (inner) =>
          Effect.succeed(
            inner.pipe(
              HttpClient.mapRequest((request) => HttpClientRequest.prependUrl(request, ingestUrl)),
            ),
          ),
      });
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  );

  const capture = (request: CaptureRequest): Effect.Effect<VoidhashCaptureResult, CaptureError> =>
    Effect.gen(function* () {
      if (!publishableKey) {
        return yield* Effect.fail(
          new VoidhashNodeConfigurationError(
            "publishableKey is required to capture events: ingest authenticates on the publishable key, not the secret key.",
          ),
        );
      }

      const sentAt = yield* DateTime.nowAsDate;
      const response = yield* client.eventCaptureCapture({
        uuid: newEventId(),
        event: request.event,
        // Both are required objects on the wire; `null` and `[]` are rejected.
        context: request.context ?? {},
        properties: request.properties ?? {},
        distinct_id: request.distinctId,
        ...timestampPatch(request.timestamp),
        sent_at: sentAt.toISOString(),
        token: publishableKey,
      });

      return { accepted: response.accepted, rejected: response.rejected };
    });

  return { capture };
};
