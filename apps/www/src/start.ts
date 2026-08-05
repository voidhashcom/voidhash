import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

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

  try {
    const forwardedUrl = new URL(`${forwardedProtocol}://${forwardedHost}`);
    return localHostnames.has(forwardedUrl.hostname) ? forwardedUrl.origin : internalUrl.origin;
  } catch {
    return internalUrl.origin;
  }
};

const isAllowedOrigin = (origin: string, request: Request): boolean => {
  try {
    return new URL(origin).origin === requestOrigin(request);
  } catch {
    return false;
  }
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
