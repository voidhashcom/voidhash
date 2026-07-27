import { vi } from "vitest";

export interface FetchCall {
  readonly body?: string;
  readonly headers: Record<string, string>;
  readonly method: string;
  readonly url: string;
}

export const createJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  });

let currentCalls: FetchCall[] = [];
let currentHandler: (call: FetchCall) => Promise<Response> | Response = () =>
  new Response(null, { status: 500 });

const fetchMock = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
  const request = input instanceof Request ? input : undefined;
  const headers = new Headers(request?.headers ?? init?.headers);
  const bodySource = init?.body;
  const requestBody =
    typeof bodySource === "string"
      ? bodySource
      : bodySource instanceof Uint8Array
        ? new TextDecoder().decode(bodySource)
        : request
          ? await request.clone().text()
          : undefined;
  const call: FetchCall = {
    body: requestBody === "" ? undefined : requestBody,
    headers: Object.fromEntries(headers.entries()),
    method: init?.method ?? request?.method ?? "GET",
    url: request?.url ?? input.toString(),
  };

  currentCalls.push(call);
  return currentHandler(call);
});

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
