import { Console, Effect } from "effect";
import { HttpClient } from "effect/unstable/http";

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
  typeof value === "object" && value !== null;

const isSensitiveHeader = (name: string) =>
  SENSITIVE_HEADER_PATTERNS.some((pattern) => pattern.test(name));

const sanitizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  const sanitized: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    sanitized[name] = isSensitiveHeader(name)
      ? "[REDACTED]"
      : truncate(value, MAX_VALUE_PREVIEW_CHARS);
  }

  return sanitized;
};

const isTextLikeContentType = (contentType: string | undefined) =>
  typeof contentType === "string"
    ? /json|text\/|xml|x-www-form-urlencoded/i.test(contentType)
    : false;

const decodeUtf8Preview = (bytes: Uint8Array) => {
  const limited = bytes.slice(0, MAX_BODY_PREVIEW_BYTES);
  try {
    if (typeof TextDecoder !== "undefined") {
      return truncate(new TextDecoder().decode(limited), MAX_VALUE_PREVIEW_CHARS);
    }

    let fallback = "";
    for (const byte of limited) {
      fallback += String.fromCharCode(byte);
    }
    return truncate(fallback, MAX_VALUE_PREVIEW_CHARS);
  } catch {
    return "<unable to decode request body>";
  }
};

const summarizeBody = (body: unknown) => {
  if (!isRecord(body) || typeof body._tag !== "string") {
    return undefined;
  }

  if (body._tag === "Empty") {
    return { type: "Empty" };
  }

  if (body._tag === "FormData") {
    return { type: "FormData" };
  }

  if (body._tag === "Stream") {
    return {
      type: "Stream",
      contentLength: typeof body.contentLength === "number" ? body.contentLength : null,
      contentType: typeof body.contentType === "string" ? body.contentType : null,
    };
  }

  if (body._tag === "Raw") {
    const value = body.body;
    if (typeof value === "string") {
      return {
        preview: truncate(value, MAX_VALUE_PREVIEW_CHARS),
        type: "Raw",
      };
    }

    try {
      return {
        preview: truncate(JSON.stringify(value), MAX_VALUE_PREVIEW_CHARS),
        type: "Raw",
      };
    } catch {
      return { preview: "<unserializable body>", type: "Raw" };
    }
  }

  if (body._tag === "Uint8Array") {
    const contentType = typeof body.contentType === "string" ? body.contentType : undefined;
    const bytes = body.body;

    if (!(bytes instanceof Uint8Array)) {
      return {
        contentLength: typeof body.contentLength === "number" ? body.contentLength : null,
        contentType: contentType ?? null,
        type: "Uint8Array",
      };
    }

    return {
      contentLength: bytes.byteLength,
      contentType: contentType ?? null,
      preview: isTextLikeContentType(contentType) ? decodeUtf8Preview(bytes) : "<binary payload>",
      type: "Uint8Array",
    };
  }

  return { type: body._tag };
};

const summarizeError = (error: unknown) => {
  if (!isRecord(error)) {
    return {
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const summary: Record<string, unknown> = {};
  if (typeof error._tag === "string") {
    summary.tag = error._tag;
  }
  if (typeof error.message === "string") {
    summary.message = error.message;
  }
  if (typeof error.reason === "string") {
    summary.reason = error.reason;
  }
  if (isRecord(error.response) && typeof error.response.status === "number") {
    summary.status = error.response.status;
  }

  return Object.keys(summary).length > 0
    ? summary
    : { message: error instanceof Error ? error.message : String(error) };
};

export const withHttpDebugLogging = (client: HttpClient.HttpClient) =>
  client.pipe(
    HttpClient.transform((effect, request) => {
      const startedAt = Date.now();

      return Effect.gen(function* debugHttpRequest() {
        yield* Console.debug("[voidhash:http] request", {
          body: summarizeBody(request.body),
          headers: sanitizeHeaders(request.headers),
          method: request.method,
          url: request.url,
        });

        return yield* effect.pipe(
          Effect.tap((response) =>
            Console.debug("[voidhash:http] response", {
              durationMs: Date.now() - startedAt,
              headers: sanitizeHeaders(response.headers),
              method: request.method,
              status: response.status,
              url: request.url,
            }),
          ),
          Effect.tapError((error) =>
            Console.error("[voidhash:http] error", {
              durationMs: Date.now() - startedAt,
              error: summarizeError(error),
              method: request.method,
              url: request.url,
            }),
          ),
        );
      });
    }),
  );
