import { oauthProviderOpenIdConfigMetadata } from '@better-auth/oauth-provider';
import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/lib/auth';

export const Route = createFileRoute('/api/.well-known/openid-configuration')({
  server: {
    handlers: {
      GET: ({ request }) => {
        return oauthProviderOpenIdConfigMetadata(auth, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET'
          }
        })(request);
      }
    }
  }
});
