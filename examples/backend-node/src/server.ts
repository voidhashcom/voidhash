import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { HttpError, sendJson } from "./http";
import { VoidhashUnavailableError } from "./voidhash";

export type RouteHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
) => void | Promise<void>;

export type Route = {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly handler: RouteHandler;
};

const normalizePath = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;

const toResponse = (error: unknown): { status: number; body: Record<string, unknown> } => {
  if (error instanceof HttpError) {
    return { body: { error: error.code, message: error.message }, status: error.status };
  }

  // Voidhash could not answer and nothing was cached. 503 says "ask again",
  // which is the honest answer; a 402 here would lock out a paying customer
  // over a network blip.
  if (error instanceof VoidhashUnavailableError) {
    return { body: { error: "voidhash_unavailable" }, status: 503 };
  }

  console.error("[nimbus] unhandled error", error);

  return { body: { error: "internal_error" }, status: 500 };
};

/**
 * A `node:http` server with a hand-rolled exact-match router.
 *
 * There is no framework here on purpose. It keeps the example about Voidhash,
 * and it means `POST /webhooks/voidhash` reads the raw body by default instead
 * of having to opt out of a JSON body parser.
 */
export const createServer = (routes: ReadonlyArray<Route>): Server => {
  const table = new Map(routes.map((route) => [`${route.method} ${route.path}`, route.handler]));

  return createHttpServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const handler = table.get(`${request.method ?? ""} ${normalizePath(url.pathname)}`);

    if (handler === undefined) {
      sendJson(response, 404, { error: "not_found" });

      return;
    }

    void (async () => {
      try {
        await handler(request, response, url);
      } catch (error) {
        if (response.headersSent) {
          response.end();

          return;
        }

        const { body, status } = toResponse(error);
        sendJson(response, status, body);
      }
    })();
  });
};
