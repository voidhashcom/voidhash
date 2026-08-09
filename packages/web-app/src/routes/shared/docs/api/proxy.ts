import { createFileRoute } from "@tanstack/react-router";

import { openapi } from "@/features/docs/lib/openapi";

/**
 * Proxy for the OpenAPI "try it" playground. Playground requests are routed
 * through our own origin to avoid CORS; `allowedOrigins` restricts forwarding
 * to the Voidhash API hosts so this can't be abused as an open proxy.
 */
const proxy = openapi.createProxy({
  allowedOrigins: [
    "https://api.voidhash.com",
    "https://api.preview.voidhash.com",
    "http://localhost:1337",
  ],
});

export const Route = createFileRoute("/docs/api/proxy")({
  server: {
    handlers: {
      GET: ({ request }) => proxy.GET(request),
      POST: ({ request }) => proxy.POST(request),
      PUT: ({ request }) => proxy.PUT(request),
      PATCH: ({ request }) => proxy.PATCH(request),
      DELETE: ({ request }) => proxy.DELETE(request),
      HEAD: ({ request }) => proxy.HEAD(request),
    },
  },
});
