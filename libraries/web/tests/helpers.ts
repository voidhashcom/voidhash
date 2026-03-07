import { vi } from "vitest";

export interface FetchCall {
  readonly body?: string;
  readonly headers: Record<string, string>;
  readonly method: string;
  readonly url: string;
}

export const createJsonResponse = (
  body: Record<string, unknown>,
  status = 200
) =>
  new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });

export const flushMicrotasks = async (times = 4) => {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
};

export const installFetchMock = (
  handler: (call: FetchCall) => Promise<Response> | Response
) => {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const call: FetchCall = {
      body:
        typeof init?.body === "string"
          ? init.body
          : init?.body instanceof Uint8Array
            ? new TextDecoder().decode(init.body)
            : undefined,
      headers: Object.fromEntries(headers.entries()),
      method: init?.method ?? "GET",
      url: input.toString(),
    };

    calls.push(call);
    return handler(call);
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    fetchMock,
  };
};
