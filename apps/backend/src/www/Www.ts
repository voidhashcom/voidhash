// This module is the Node HTTP platform adapter for the self-hosted WWW surface: it is handed a
// raw `http.IncomingMessage`/`ServerResponse` pair by a Node server and must speak Node's callback
// and promise APIs directly. Every handler here is an `async` function because that is the shape
// the Node server (and srvx's `sendNodeResponse`) requires; wrapping them in Effect would mean
// running a runtime per request and would leak an Effect dependency into the selfhost entrypoint.
// oxlint-disable effect/noAsyncFunction -- Node HTTP adapter: the exported handlers must BE async functions with the exact `(req, res) => Promise<void>` signature Node's `http.Server` and srvx call; Effect.gen cannot be handed to `server.on("request", ...)`.

// oxlint-disable-next-line effect/noNodeBuiltinImport -- platform adapter: the byte stream is piped straight into a Node `ServerResponse`, which only accepts a Node stream, not an Effect FileSystem Stream.
import { createReadStream } from "node:fs";
// oxlint-disable-next-line effect/noNodeBuiltinImport -- platform adapter: `stat` is called from an async Node request handler that has no Effect runtime to provide FileSystem from.
import { stat } from "node:fs/promises";
// oxlint-disable-next-line effect/noNodeBuiltinImport -- type-only import of Node's real `IncomingMessage`/`ServerResponse`; these are the concrete values Node hands the handler, so no Effect HttpServer type can stand in.
import type { IncomingMessage, ServerResponse } from "node:http";
// oxlint-disable-next-line effect/noNodeBuiltinImport -- platform adapter: path resolution happens synchronously inside the Node request handler, outside any Effect runtime that could supply Path.
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { NodeRequest, sendNodeResponse } from "srvx/node";

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

type WwwFetch = (request: Request) => Response | Promise<Response>;

export type WwwRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

export interface WwwHandlerOptions {
  readonly clientDirectory: string;
  readonly fetch: WwwFetch;
}

const isWithinDirectory = (directory: string, candidate: string): boolean =>
  candidate === directory || candidate.startsWith(`${directory}${sep}`);

const serveStaticFile = async (
  clientDirectory: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<boolean> => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  let pathname: string;
  // oxlint-disable-next-line effect/noTryCatch -- guards the synchronous `decodeURIComponent`/`URL` throw on a malformed request path; this runs in a plain Node handler with no Effect runtime, and a malformed URL must simply fall through to the app fetch handler.
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://selfhost.local").pathname);
  } catch {
    return false;
  }

  const directory = resolve(clientDirectory);
  const candidate = resolve(directory, `.${pathname}`);
  if (!isWithinDirectory(directory, candidate)) {
    return false;
  }

  let metadata;
  // oxlint-disable-next-line effect/noTryCatch -- distinguishes ENOENT (fall through to the app handler) from real IO failures inside a plain Node handler; there is no Effect runtime here to carry a typed error.
  try {
    metadata = await stat(candidate);
  } catch (error) {
    // oxlint-disable-next-line effect/noAs -- Node rejects `stat` with a bare `Error`; narrowing to `ErrnoException` to read `.code` is the only way to detect ENOENT, and `satisfies` cannot narrow an `unknown` catch binding.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    // oxlint-disable-next-line effect/noThrowStatement -- rethrows the original Node IO error to the Node server's own error handling; converting it to an Effect failure would require an Effect runtime this adapter deliberately does not have.
    throw error;
  }

  if (!metadata.isFile()) {
    return false;
  }

  response.statusCode = 200;
  response.setHeader(
    "Cache-Control",
    // oxlint-disable-next-line effect/noTernary -- inline header-value selection in a Node adapter; Match.value would pull an Effect import into this deliberately Effect-free module for a two-branch string choice.
    pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
  );
  response.setHeader("Content-Length", metadata.size);
  response.setHeader(
    "Content-Type",
    contentTypes[extname(candidate).toLowerCase()] ?? "application/octet-stream",
  );
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (request.method === "HEAD") {
    response.end();
    return true;
  }

  // oxlint-disable-next-line effect/noNewPromise -- bridges Node's stream/response event callbacks ("error"/"finish") into the async handler contract; the caller is Node, not an Effect runtime, so Effect.async has nothing to run in here.
  await new Promise<void>((resolveStream, rejectStream) => {
    const stream = createReadStream(candidate);
    stream.once("error", rejectStream);
    response.once("finish", resolveStream);
    response.once("error", rejectStream);
    stream.pipe(response);
  });
  return true;
};

/**
 * Creates a Node HTTP handler for the built TanStack Start application and its client assets.
 */
export const makeWwwRequestHandler = ({
  clientDirectory,
  fetch,
}: WwwHandlerOptions): WwwRequestHandler =>
  async (request, response) => {
    if (await serveStaticFile(clientDirectory, request, response)) {
      return;
    }

    const webResponse = await fetch(new NodeRequest({ req: request, res: response }));
    response.setHeaders(webResponse.headers);
    response.writeHead(webResponse.status, webResponse.statusText);
    await sendNodeResponse(response, webResponse);
  };

/** Loads the built TanStack Start server entry and returns its Node HTTP handler. */
export const loadWwwRequestHandler = async (
  serverEntry: string,
  clientDirectory: string,
): Promise<WwwRequestHandler> => {
  // oxlint-disable-next-line effect/noAs -- the built TanStack Start server entry is loaded by URL at runtime, so its module shape is `any` to the compiler; `satisfies` cannot type an untyped dynamic import, and the shape is checked at runtime just below.
  const loaded = (await import(pathToFileURL(resolve(serverEntry)).href)) as {
    readonly default?: { readonly fetch?: WwwFetch };
  };
  const fetch = loaded.default?.fetch;
  if (fetch === undefined) {
    // oxlint-disable-next-line effect/noThrowStatement, effect/noNewError -- this loader returns a plain Promise to the selfhost bootstrap, which runs before any Effect runtime exists; a missing WWW build is a fatal startup misconfiguration and a rejected promise is the only failure channel the caller has.
    throw new Error(`WWW server entry does not export a default fetch handler: ${serverEntry}`);
  }

  return makeWwwRequestHandler({ clientDirectory, fetch: fetch.bind(loaded.default) });
};

/** Returns whether the request belongs to the WWW surface rather than a backend route. */
export const isWwwRequest = (url: string | undefined): boolean => {
  const pathname = new URL(url ?? "/", "http://selfhost.local").pathname;

  if (
    pathname === "/health" ||
    pathname === "/rpc" ||
    pathname.startsWith("/rpc/") ||
    pathname === "/i" ||
    pathname.startsWith("/i/") ||
    pathname === "/files" ||
    pathname.startsWith("/files/") ||
    pathname === "/p" ||
    pathname.startsWith("/p/") ||
    pathname === "/c" ||
    pathname.startsWith("/c/")
  ) {
    return false;
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return pathname === "/api/auth" || pathname.startsWith("/api/auth/");
  }

  return true;
};
