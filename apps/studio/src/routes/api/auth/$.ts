import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const corsHeaders = {
  'Access-Control-Allow-Origin': env.VITE_APP_AUTH_BASE_URL,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

async function handleAuthRequest(request: Request): Promise<Response> {
  const response = await auth.handler(request);

  // Add CORS headers to the response
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => {
        return handleAuthRequest(request);
      },
      POST: ({ request }) => {
        return handleAuthRequest(request);
      }
    }
  }
});
