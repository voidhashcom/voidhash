import { createFileRoute } from "@tanstack/react-router";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

const corsHeaders = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": env.VITE_APP_AUTH_BASE_URL,
};

async function handleAuthRequest(request: Request): Promise<Response> {
  const response = await auth.handler(request);

  // Add CORS headers to the response
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    headers: newHeaders,
    status: response.status,
    statusText: response.statusText,
  });
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthRequest(request),
      POST: ({ request }) => handleAuthRequest(request),
    },
  },
});
