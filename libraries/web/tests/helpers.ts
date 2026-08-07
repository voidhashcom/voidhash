import { Effect, Schema } from "effect";
import { vi } from "vitest";

export interface FetchCall {
  readonly body?: string;
  readonly headers: Record<string, string>;
  readonly method: string;
  readonly url: string;
}

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

export const createJsonResponse = (
  body: Record<string, unknown>,
  status = 200,
  headers?: Record<string, string>,
) =>
  new Response(encodeJson(body), {
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    status,
  });

export const flushMicrotasks = (times = 4) =>
  Effect.runPromise(Effect.forEach(Array.from({ length: times }), () => Effect.yieldNow));

const readRequestBody = (request: Request): Effect.Effect<string | undefined> =>
  Effect.tryPromise({
    try: () => request.clone().text(),
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed((): string | undefined => undefined));

const readInitBody = (body: RequestInit["body"]) => {
  if (typeof body === "string") {
    return body;
  }

  if (body && ArrayBuffer.isView(body)) {
    return new TextDecoder().decode(body);
  }

  return undefined;
};

const describeCall = (input: URL | RequestInfo, init?: RequestInit): Effect.Effect<FetchCall> => {
  if (input instanceof Request) {
    return Effect.map(readRequestBody(input), (body) => ({
      body,
      headers: Object.fromEntries(new Headers(input.headers).entries()),
      method: input.method,
      url: input.url,
    }));
  }

  return Effect.succeed({
    body: readInitBody(init?.body),
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
    method: init?.method ?? "GET",
    url: input.toString(),
  });
};

const runHandler = (
  handler: (call: FetchCall) => Promise<Response> | Response,
  call: FetchCall,
): Effect.Effect<Response> => {
  const result = handler(call);
  if (result instanceof Response) {
    return Effect.succeed(result);
  }

  return Effect.promise(() => result);
};

export const installFetchMock = (handler: (call: FetchCall) => Promise<Response> | Response) => {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn((input: URL | RequestInfo, init?: RequestInit) =>
    Effect.runPromise(
      Effect.gen(function* mockFetch() {
        const call = yield* describeCall(input, init);
        calls.push(call);
        return yield* runHandler(handler, call);
      }),
    ),
  );

  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    fetchMock,
  };
};
