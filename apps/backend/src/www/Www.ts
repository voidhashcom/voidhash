import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
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
  try {
    metadata = await stat(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }

  if (!metadata.isFile()) {
    return false;
  }

  response.statusCode = 200;
  response.setHeader(
    "Cache-Control",
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
  const loaded = (await import(pathToFileURL(resolve(serverEntry)).href)) as {
    readonly default?: { readonly fetch?: WwwFetch };
  };
  const fetch = loaded.default?.fetch;
  if (fetch === undefined) {
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
