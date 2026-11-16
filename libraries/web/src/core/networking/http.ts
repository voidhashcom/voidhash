/**
 * The SDK's HTTP transport: `fetch`, wrapped so an interrupted request is
 * aborted. It replaces Effect's HTTP client, which carries far more than four
 * JSON endpoints need into every page that loads the SDK.
 */
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";

export interface HttpRequest {
  readonly method: "GET" | "POST";
  /** Absolute URL the path is appended to; a path prefix, as a proxy mounts, is kept. */
  readonly baseUrl: string;
  readonly path: string;
  /** Header values left `undefined` are not sent. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- the SDK's header bags leave optional headers undefined, as `fetch` header objects do.
  readonly headers: Readonly<Record<string, string | undefined>>;
  /** Sent as JSON when present, as `application/json` unless the headers name another type. */
  readonly body?: unknown;
  /** Lets the browser finish the request after the page is gone. */
  readonly keepalive?: boolean;
}

export interface HttpResponse {
  readonly status: number;
  /** Response headers, with lower-case names. */
  readonly headers: Readonly<Record<string, string>>;
  /** The body read as JSON, `null` when it is empty; none when it could not be read or parsed. */
  readonly json: Option.Option<unknown>;
}

/** No response arrived: the network failed, or `fetch` refused the request. */
// oxlint-disable-next-line effect/prefer-schema-class -- a Schema-based error would bring Effect's Schema module into every page that loads the SDK.
export class HttpTransportError extends Data.TaggedError("HttpTransportError")<{
  readonly cause: unknown;
}> {}

/** Joins a base URL and a path with exactly one slash between them. */
const joinUrl = (baseUrl: string, path: string) => {
  const endsWithSlash = baseUrl.endsWith("/");
  const startsWithSlash = path.startsWith("/");
  if (endsWithSlash && startsWithSlash) return baseUrl + path.slice(1);
  if (!endsWithSlash && !startsWithSlash) return `${baseUrl}/${path}`;
  return baseUrl + path;
};

const parseJson = (text: string): Option.Option<unknown> =>
  text === ""
    ? Option.some(null)
    : Result.getSuccess(Result.try({ catch: () => undefined, try: () => JSON.parse(text) }));

const requestHeaders = (request: HttpRequest) => {
  const headers = R.fromEntries(
    Arr.filterMap(R.toEntries(request.headers), ([name, value]) =>
      value === undefined ? Result.failVoid : Result.succeed([name.toLowerCase(), value] as const),
    ),
  );
  return request.body === undefined ? headers : { "content-type": "application/json", ...headers };
};

/** The transport over `fetch`, which the client takes from the page when it starts. */
export const makeHttpTransport = (fetch: typeof globalThis.fetch) => ({
  /**
   * Sends one request and reads its body. Fails only when no response
   * arrived; an error status is a response like any other. Interrupting the
   * effect aborts the request, including the read of its body.
   */
  send: (request: HttpRequest): Effect.Effect<HttpResponse, HttpTransportError> =>
    Effect.tryPromise({
      catch: (cause) => new HttpTransportError({ cause }),
      try: async (signal) => {
        const response = await fetch(joinUrl(request.baseUrl, request.path), {
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          headers: requestHeaders(request),
          keepalive: request.keepalive,
          method: request.method,
          // Voidhash needs no referrer. The page's own policy can send its
          // full address, and through a proxy on the site's origin it always
          // does, though `analytics.sanitizeUrl` may keep that address out.
          referrerPolicy: "strict-origin",
          signal,
        });
        const json = await response.text().then(parseJson, () => Option.none());
        return {
          headers: R.fromEntries(response.headers.entries()),
          json,
          status: response.status,
        };
      },
    }),
});

export class HttpTransport extends Context.Service<
  HttpTransport,
  ReturnType<typeof makeHttpTransport>
>()("web-voidhash/HttpTransport") {}
