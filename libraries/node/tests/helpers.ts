import { Effect, Schema } from "effect";
import { vi } from "vitest";

export interface FetchCall {
  readonly body?: string;
  readonly headers: Record<string, string>;
  readonly method: string;
  readonly url: string;
}

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

/** Decodes a captured request body that was serialized as JSON. */
export const decodeJson = Schema.decodeSync(Schema.UnknownFromJsonString);

export const createJsonResponse = (body: unknown, status = 200) =>
  new Response(encodeJson(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });

let currentCalls: FetchCall[] = [];
let currentHandler: (call: FetchCall) => Promise<Response> | Response = () =>
  new Response(null, { status: 500 });

const asRequest = (input: URL | RequestInfo): Request | undefined => {
  if (input instanceof Request) {
    return input;
  }

  return undefined;
};

const readRequestBody = (
  request: Request | undefined,
  bodySource: RequestInit["body"],
): Effect.Effect<string | undefined> => {
  if (typeof bodySource === "string") {
    return Effect.succeed(bodySource);
  }

  if (bodySource instanceof Uint8Array) {
    return Effect.succeed(new TextDecoder().decode(bodySource));
  }

  if (request) {
    return Effect.promise(() => request.clone().text());
  }

  return Effect.succeed(undefined);
};

const normalizeBody = (body: string | undefined) => {
  if (body === "") {
    return undefined;
  }

  return body;
};

const runHandler = (call: FetchCall): Effect.Effect<Response> => {
  const result = currentHandler(call);

  if (result instanceof Response) {
    return Effect.succeed(result);
  }

  return Effect.promise(() => result);
};

const requestUrl = (input: URL | RequestInfo): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

const fetchMock = vi.fn((input: URL | RequestInfo, init?: RequestInit) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const request = asRequest(input);
      const headers = new Headers(request?.headers ?? init?.headers);
      const requestBody = yield* readRequestBody(request, init?.body);
      const call: FetchCall = {
        body: normalizeBody(requestBody),
        headers: Object.fromEntries(headers.entries()),
        method: init?.method ?? request?.method ?? "GET",
        url: request?.url ?? requestUrl(input),
      };

      currentCalls.push(call);

      return yield* runHandler(call);
    }),
  ),
);

export const installFetchMock = (handler: (call: FetchCall) => Promise<Response> | Response) => {
  currentCalls = [];
  currentHandler = handler;
  fetchMock.mockClear();

  vi.stubGlobal("fetch", fetchMock);

  return {
    calls: currentCalls,
    fetchMock,
  };
};
