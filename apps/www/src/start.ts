import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { Effect, Result } from "effect";

import { authRequestMiddleware } from "@/features/auth/adapter/session-adapter";

const localHostnames = new Set(["0.0.0.0", "127.0.0.1", "[::1]", "localhost"]);

const requestOrigin = (request: Request): string => {
  const internalUrl = new URL(request.url);
  if (!localHostnames.has(internalUrl.hostname)) {
    return internalUrl.origin;
  }

  const forwardedHost = request.headers.get("X-Forwarded-Host");
  const forwardedProtocol = request.headers.get("X-Forwarded-Proto");
  if (!(forwardedHost && forwardedProtocol)) {
    return internalUrl.origin;
  }

  const forwarded = Effect.runSync(
    Effect.try(() => new URL(`${forwardedProtocol}://${forwardedHost}`)).pipe(Effect.result),
  );
  if (Result.isFailure(forwarded)) {
    return internalUrl.origin;
  }
  const forwardedUrl = forwarded.success;
  return localHostnames.has(forwardedUrl.hostname) ? forwardedUrl.origin : internalUrl.origin;
};

const isAllowedOrigin = (origin: string, request: Request): boolean => {
  const parsed = Effect.runSync(Effect.try(() => new URL(origin).origin).pipe(Effect.result));
  if (Result.isFailure(parsed)) {
    return false;
  }
  return parsed.success === requestOrigin(request);
};

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  // Local Cloudflare workers replace the public loopback host in request.url.
  origin: (origin, ctx) => isAllowedOrigin(origin, ctx.request),
});

export const startInstance = createStart(() => ({
  // Providers that maintain a server-side session (refreshing a sealed cookie,
  // for example) contribute their middleware through the adapter slot.
  requestMiddleware: [csrfMiddleware, ...authRequestMiddleware],
}));
