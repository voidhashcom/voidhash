import { vi } from "vitest";

export interface FetchCall {
  readonly body?: string;
  readonly headers: Record<string, string>;
  readonly method: string;
  readonly url: string;
}

export const createJsonResponse = (
  body: Record<string, unknown>,
  status = 200,
  headers?: Record<string, string>
) =>
  new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      ...headers,
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
    let url: string;
    let method: string;
    let headers: Headers;
    let bodyStr: string | undefined;

    if (input instanceof Request) {
      url = input.url;
      method = input.method;
      headers = new Headers(input.headers);
      try {
        bodyStr = await input.clone().text();
      } catch {
        bodyStr = undefined;
      }
    } else {
      url = input.toString();
      method = init?.method ?? "GET";
      headers = new Headers(init?.headers);
      if (typeof init?.body === "string") {
        bodyStr = init.body;
      } else if (init?.body && ArrayBuffer.isView(init.body)) {
        bodyStr = new TextDecoder().decode(init.body);
      } else {
        bodyStr = undefined;
      }
    }

    const call: FetchCall = {
      body: bodyStr,
      headers: Object.fromEntries(headers.entries()),
      method,
      url,
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
