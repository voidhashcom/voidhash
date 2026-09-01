import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as R from "effect/Record";
import * as P from "effect/Predicate";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import { HttpClient } from "effect/unstable/http";
import * as Schema from "effect/Schema";
const effectEncodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

const MAX_BODY_PREVIEW_BYTES = 2_048;
const MAX_VALUE_PREVIEW_CHARS = 1_024;
const SENSITIVE_HEADER_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /secret/i,
  /password/i,
  /token/i,
  /api[-_]?key/i,
];

const truncate = (value: string, maxLength: number) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}...<truncated>`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  P.isObject(value) && value !== null;

const isSensitiveHeader = (name: string) =>
  SENSITIVE_HEADER_PATTERNS.some((pattern) => pattern.test(name));

const sanitizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  return R.map(headers, (value, name) =>
    isSensitiveHeader(name) ? "[REDACTED]" : truncate(value, MAX_VALUE_PREVIEW_CHARS),
  );
};

const isTextLikeContentType = (contentType: Option.Option<string>) =>
  Option.exists(contentType, (value) => /json|text\/|xml|x-www-form-urlencoded/i.test(value));

const decodeUtf8Preview = (bytes: Uint8Array) => {
  const limited = bytes.slice(0, MAX_BODY_PREVIEW_BYTES);
  return Effect.try(() => {
    if (!P.isUndefined(TextDecoder)) {
      return truncate(new TextDecoder().decode(limited), MAX_VALUE_PREVIEW_CHARS);
    }

    const fallback = Arr.fromIterable(limited)
      .map((byte) => String.fromCharCode(byte))
      .join("");
    return truncate(fallback, MAX_VALUE_PREVIEW_CHARS);
  }).pipe(Effect.orElseSucceed(() => "<unable to decode request body>"));
};

const summarizeBody = (body: unknown) => {
  if (!isRecord(body) || !P.isString(body._tag)) {
    return Effect.succeed(undefined);
  }

  return Match.value(body._tag).pipe(
    Match.when("Empty", () => Effect.succeed({ type: "Empty" })),
    Match.when("FormData", () => Effect.succeed({ type: "FormData" })),
    Match.when("Stream", () =>
      Effect.succeed({
        type: "Stream",
        contentLength: P.isNumber(body.contentLength) ? body.contentLength : null,
        contentType: P.isString(body.contentType) ? body.contentType : null,
      }),
    ),
    Match.when("Raw", () => {
      const value = body.body;
      if (P.isString(value)) {
        return Effect.succeed({
          preview: truncate(value, MAX_VALUE_PREVIEW_CHARS),
          type: "Raw",
        });
      }
      return Effect.try(() => ({
        preview: truncate(effectEncodeJson(value), MAX_VALUE_PREVIEW_CHARS),
        type: "Raw",
      })).pipe(Effect.orElseSucceed(() => ({ preview: "<unserializable body>", type: "Raw" })));
    }),
    Match.when("Uint8Array", () => {
      const contentType = Option.liftPredicate(body.contentType, P.isString);
      const bytes = body.body;
      if (!P.isUint8Array(bytes)) {
        return Effect.succeed({
          contentLength: P.isNumber(body.contentLength) ? body.contentLength : null,
          contentType: Option.getOrNull(contentType),
          type: "Uint8Array",
        });
      }
      return Effect.gen(function* () {
        const preview = isTextLikeContentType(contentType)
          ? yield* decodeUtf8Preview(bytes)
          : "<binary payload>";
        return {
          contentLength: bytes.byteLength,
          contentType: Option.getOrNull(contentType),
          preview,
          type: "Uint8Array",
        };
      });
    }),
    Match.orElse((type) => Effect.succeed({ type })),
  );
};

const summarizeError = (error: unknown) => {
  if (!isRecord(error)) {
    return {
      message: P.isError(error) ? error.message : String(error),
    };
  }

  const summary: Record<string, unknown> = {};
  if (P.isString(error._tag)) {
    summary.tag = error._tag;
  }
  if (P.isString(error.message)) {
    summary.message = error.message;
  }
  if (P.isString(error.reason)) {
    summary.reason = error.reason;
  }
  if (isRecord(error.response) && P.isNumber(error.response.status)) {
    summary.status = error.response.status;
  }

  if (Arr.isReadonlyArrayNonEmpty(R.keys(summary))) return summary;
  return { message: P.isError(error) ? error.message : effectEncodeJson(error) };
};

export const withHttpDebugLogging = (client: HttpClient.HttpClient) =>
  client.pipe(
    HttpClient.transform((effect, request) => {
      return Effect.gen(function* debugHttpRequest() {
        const startedAt = yield* Clock.currentTimeMillis;
        const body = yield* summarizeBody(request.body);
        yield* Console.debug("[voidhash:http] request", {
          body,
          headers: sanitizeHeaders(request.headers),
          method: request.method,
          url: request.url,
        });

        return yield* effect.pipe(
          Effect.tap((response) =>
            Effect.gen(function* () {
              const finishedAt = yield* Clock.currentTimeMillis;
              yield* Console.debug("[voidhash:http] response", {
                durationMs: finishedAt - startedAt,
                headers: sanitizeHeaders(response.headers),
                method: request.method,
                status: response.status,
                url: request.url,
              });
            }),
          ),
          Effect.tapError((error) =>
            Effect.gen(function* () {
              const finishedAt = yield* Clock.currentTimeMillis;
              yield* Console.error("[voidhash:http] error", {
                durationMs: finishedAt - startedAt,
                error: summarizeError(error),
                method: request.method,
                url: request.url,
              });
            }),
          ),
        );
      });
    }),
  );
