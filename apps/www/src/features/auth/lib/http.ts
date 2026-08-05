/**
 * Provider-neutral HTTP helpers shared by every auth route handler.
 *
 * Extracted so the standalone routes and any private identity-provider adapter
 * can build responses the same way without depending on each other.
 */
import { toSafeReturnPathname } from "./validation";

export type JsonBody = Record<string, unknown>;

const appendHeaders = (target: Headers, source?: Record<string, string | string[]>) => {
  if (!source) {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        target.append(key, item);
      }
      continue;
    }

    target.append(key, value);
  }
};

/** JSON response with optional extra headers (`Set-Cookie` may repeat). */
export const jsonResponse = (
  body: JsonBody,
  init: ResponseInit = {},
  extraHeaders?: Record<string, string | string[]>,
) => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  appendHeaders(headers, extraHeaders);
  return new Response(JSON.stringify(body), { ...init, headers });
};

/** Uniform `{ error }` body for a failed authentication attempt. */
export const authErrorResponse = (message: string, status = 400) =>
  jsonResponse({ error: message }, { status });

/** Parses a JSON request body, treating malformed input as empty. */
export const getJsonBody = async <T extends object>(request: Request): Promise<Partial<T>> => {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {} as Partial<T>;
  }
};

/** Same-origin `returnPathname` from the query string, or the fallback. */
export const getSafeReturnPathnameFromRequest = (request: Request, fallback = "/studio") => {
  const url = new URL(request.url);
  return toSafeReturnPathname(url.searchParams.get("returnPathname"), url.origin) ?? fallback;
};

/** Same-origin `returnPathname` from an arbitrary value, or the fallback. */
export const getSafeReturnPathname = (
  request: Request,
  value: string | null | undefined,
  fallback = "/studio",
) => toSafeReturnPathname(value, new URL(request.url).origin) ?? fallback;
