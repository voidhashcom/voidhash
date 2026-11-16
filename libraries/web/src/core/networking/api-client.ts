/**
 * The SDK endpoints the browser calls. They are written out here rather
 * than taken from the generated API client: that client covers the whole API
 * and is one object, so a bundler cannot drop the endpoints a web page never
 * uses, and it would add more code than the rest of the SDK. Request bodies
 * are checked against the generated contract types, which are erased from the
 * build, and responses are checked with the guards below.
 */
import type {
  EvaluateFeatureFlagsBody,
  SdkIdentifyBody,
  SdkSyncPersonAttributesBody,
} from "@voidhash/generated-clients";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";

import type { VoidhashPerson } from "../../types";
import { ANALYTICS_CONSENT_HEADER, AnalyticsConsentState } from "../analytics/analytics-consent";
import { SdkConfiguration } from "../sdk-configuration";
import { isJsonObject } from "../json";
import { HttpTransport } from "./http";

export type WebSdkHeaders = {
  readonly "x-client-bundle-id": string;
  readonly "x-client-locale"?: string;
  readonly "x-client-version"?: string;
  readonly "x-distinct-id": string;
  readonly "x-is-backgrounded": "false" | "true";
  readonly "x-is-debug-build": "false" | "true";
  readonly "x-nonce": string;
  readonly "x-observer-mode": "false" | "true";
  readonly "x-platform": string;
  readonly "x-platform-brand"?: string;
  readonly "x-platform-device"?: string;
  readonly "x-platform-flavor": "browser" | "native";
  readonly "x-platform-flavor-version"?: string;
  readonly "x-platform-version"?: string;
  readonly "x-preferred-locales"?: string;
  readonly "x-publishable-key": string;
  readonly "x-sdk": "web" | "react-native";
  readonly "x-sdk-version": string;
  readonly "x-storefront"?: string;
};

/** SDK headers as produced by the platform provider, before identity is known. */
export type WebSdkHeadersWithoutDistinctId = Omit<WebSdkHeaders, "x-distinct-id">;

/**
 * A request to an SDK endpoint that did not succeed. `status` is the HTTP
 * status Voidhash answered with; it is none when no answer arrived, or when
 * a successful answer could not be read. `body` is the JSON an error status
 * came with, such as `{ _tag, message }`.
 */
// oxlint-disable-next-line effect/prefer-schema-class -- a Schema-based error would bring Effect's Schema module into every page that loads the SDK.
export class SdkRequestError extends Data.TaggedError("SdkRequestError")<{
  readonly body?: unknown;
  readonly cause?: unknown;
  readonly operation: string;
  readonly status: Option.Option<number>;
}> {}

/**
 * The HTTP status a failed request was answered with. None for a request
 * that got no answer, timed out, or failed for another reason.
 */
export const statusOf = (cause: unknown): Option.Option<number> =>
  cause instanceof SdkRequestError ? cause.status : Option.none();

/** The JSON body an error status came with, which tells Voidhash's own errors apart. */
export const errorBodyOf = (cause: unknown): unknown =>
  cause instanceof SdkRequestError ? cause.body : undefined;

/** Header values must be printable ASCII; `fetch` refuses anything else. */
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

/**
 * Sends a distinct id outside printable ASCII, such as `Dvořák` or `用户42`,
 * percent-encoded and marked with `x-distinct-id-encoding: percent`, which the
 * API decodes. Any other id is sent as is, so one containing `%` keeps it.
 */
const encodeDistinctIdHeader = (headers: WebSdkHeaders) =>
  PRINTABLE_ASCII.test(headers["x-distinct-id"])
    ? headers
    : {
        ...headers,
        "x-distinct-id": encodeURIComponent(headers["x-distinct-id"]),
        "x-distinct-id-encoding": "percent",
      };

// oxlint-disable-next-line effect/prefer-option-over-null -- the JSON value as it arrives; decoders turn it into the SDK's types.
const isNullableString = (value: unknown): value is string | null =>
  value === null || P.isString(value);

/** The person the person endpoints answer with; other fields are dropped. */
const decodePerson = (value: unknown): Option.Option<VoidhashPerson> => {
  if (!isJsonObject(value)) return Option.none();
  const { distinctId, email, name, personId } = value;
  return P.isString(distinctId) &&
    isNullableString(email) &&
    isNullableString(name) &&
    P.isString(personId)
    ? Option.some({ distinctId, email, name, personId })
    : Option.none();
};

const decodeFlag = (value: unknown) => {
  if (!isJsonObject(value)) return Option.none();
  const { enabled, key, payload, variantKey } = value;
  return P.isBoolean(enabled) &&
    P.isString(key) &&
    (variantKey === undefined || isNullableString(variantKey))
    ? Option.some({ enabled, key, payload: payload ?? null, variantKey: variantKey ?? null })
    : Option.none();
};

/**
 * The flags evaluate-flags answers with. One malformed flag makes the whole
 * answer unreadable, rather than some flags silently reading as off.
 */
const decodeFeatureFlags = (value: unknown) =>
  isJsonObject(value) && Array.isArray(value.flags)
    ? Option.all(value.flags.map(decodeFlag))
    : Option.none();

export const makeApiClient = Effect.fnUntraced(function* makeApiClient() {
  const config = yield* SdkConfiguration;
  const consent = yield* AnalyticsConsentState;
  const transport = yield* HttpTransport;

  /**
   * Sends one request and reads a successful answer with `decode`. Every
   * other outcome fails with {@link SdkRequestError}, carrying the status so
   * callers can tell an outage from a refusal.
   */
  const send = <A>(input: {
    readonly body: Option.Option<unknown>;
    readonly decode: (json: unknown) => Option.Option<A>;
    readonly headers: WebSdkHeaders;
    readonly method: "GET" | "POST";
    readonly operation: string;
    readonly path: string;
  }): Effect.Effect<A, SdkRequestError> =>
    Effect.gen(function* send() {
      // Read per request, so a consent change applies to the next call.
      const currentConsent = consent.current();
      const response = yield* transport
        .send({
          baseUrl: config.baseUrl,
          body: Option.getOrUndefined(input.body),
          headers: {
            ...encodeDistinctIdHeader(input.headers),
            ...(currentConsent === "granted" ? {} : { [ANALYTICS_CONSENT_HEADER]: currentConsent }),
          },
          method: input.method,
          path: input.path,
        })
        .pipe(
          Effect.mapError(
            (cause) =>
              new SdkRequestError({ cause, operation: input.operation, status: Option.none() }),
          ),
        );
      if (response.status < 200 || response.status >= 300) {
        return yield* new SdkRequestError({
          body: Option.getOrUndefined(response.json),
          operation: input.operation,
          status: Option.some(response.status),
        });
      }
      const decoded = Option.flatMap(response.json, input.decode);
      if (Option.isNone(decoded)) {
        return yield* new SdkRequestError({
          cause: "The response body could not be read.",
          operation: input.operation,
          status: Option.none(),
        });
      }
      return decoded.value;
    });

  const sdk = {
    evaluateFeatureFlags: (request: {
      readonly headers: WebSdkHeaders;
      readonly payload: EvaluateFeatureFlagsBody;
    }) =>
      Effect.map(
        send({
          body: Option.some(request.payload),
          headers: request.headers,
          method: "POST",
          operation: "featureFlags.evaluate",
          path: "/api/v1/sdk/evaluate-flags",
          decode: decodeFeatureFlags,
        }),
        (flags) => ({ flags }),
      ),
    getPerson: (request: {
      readonly headers: WebSdkHeaders;
    }): Effect.Effect<VoidhashPerson, SdkRequestError> =>
      send({
        body: Option.none(),
        headers: request.headers,
        method: "GET",
        operation: "person.get",
        path: "/api/v1/sdk/person",
        decode: decodePerson,
      }),
    identify: (request: { readonly headers: WebSdkHeaders; readonly payload: SdkIdentifyBody }) =>
      Effect.asVoid(
        send({
          body: Option.some(request.payload),
          headers: request.headers,
          method: "POST",
          operation: "identity.identify",
          path: "/api/v1/sdk/identify",
          decode: Option.some,
        }),
      ),
    syncPersonAttributes: (request: {
      readonly headers: WebSdkHeaders;
      readonly payload: SdkSyncPersonAttributesBody;
    }): Effect.Effect<VoidhashPerson, SdkRequestError> =>
      send({
        body: Option.some(request.payload),
        headers: request.headers,
        method: "POST",
        operation: "person.setAttributes",
        path: "/api/v1/sdk/person/traits",
        decode: decodePerson,
      }),
  };

  return { sdk };
});

export class ApiClient extends Context.Service<
  ApiClient,
  Effect.Success<ReturnType<typeof makeApiClient>>
>()("web-voidhash/ApiClient") {}
