import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import {
  changeOAuthClientId,
  deleteOAuthClient,
  getOAuthClient,
  getOAuthClients
} from './admin-actions.server';
import { auth } from './auth';
import { TRUSTED_CLIENTS } from './trusted-clients';

const UpdateClientSchema = z.object({
  name: z.string().optional(),
  redirectUris: z.string().optional(),
  disabled: z.boolean().optional(),
  type: z.string().optional()
});

// Get all OAuth clients
export const getAdminClients = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest();
    const session = await auth.api.getSession({
      headers: request.headers
    });

    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    if (session.user.role !== 'admin') {
      throw new Error('Forbidden');
    }

    const clients = await getOAuthClients();
    return clients.map((client) => ({
      ...client,
      metadata: {}
    }));
  }
);

// Get a specific OAuth client
export const getAdminClient = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ clientId: z.string() }))
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({
      headers: request.headers
    });

    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    if (session.user.role !== 'admin') {
      throw new Error('Forbidden');
    }

    const client = await getOAuthClient(data.clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    return {
      ...client,
      metadata: {}
    };
  });

// Update an OAuth client
export const updateAdminClient = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      clientId: z.string(),
      updates: UpdateClientSchema
    })
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({
      headers: request.headers
    });

    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    if (session.user.role !== 'admin') {
      throw new Error('Forbidden');
    }

    auth.api.adminUpdateOAuthClient({
      body: {
        client_id: data.clientId,
        update: {
          client_name: data.updates.name,
          redirect_uris: data.updates.redirectUris?.split(','),
          type: data.updates.type as 'web' | 'native' | 'user-agent-based'
        }
      },
      headers: request.headers
    });
    return { success: true };
  });

// Delete an OAuth client
export const deleteAdminClient = createServerFn({ method: 'POST' })
  .inputValidator((data: { clientId: string }) => data)
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({
      headers: request.headers
    });

    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    if (session.user.role !== 'admin') {
      throw new Error('Forbidden');
    }

    await deleteOAuthClient(data.clientId);
    return { success: true };
  });

// Rotate an OAuth client's secret
export const rotateAdminClientSecret = createServerFn({ method: 'POST' })
  .inputValidator((data: { clientId: string }) => data)
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({
      headers: request.headers
    });

    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    if (session.user.role !== 'admin') {
      throw new Error('Forbidden');
    }

    const result = await auth.api.rotateClientSecret({
      body: {
        client_id: data.clientId
      },
      headers: request.headers
    });

    if (!result) {
      throw new Error('Failed to rotate client secret');
    }

    const clientSecret =
      'client_secret' in result ? (result.client_secret as string) : null;

    if (!clientSecret) {
      throw new Error('Failed to rotate client secret');
    }

    return { clientSecret };
  });

// Sync trusted clients from configuration
export const syncTrustedClients = createServerFn({ method: 'POST' }).handler(
  async () => {
    const request = getRequest();
    const session = await auth.api.getSession({
      headers: request.headers
    });

    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    if (session.user.role !== 'admin') {
      throw new Error('Forbidden');
    }

    const results: Array<{
      clientId: string;
      action: 'created' | 'updated';
      name: string;
      clientSecret?: string;
    }> = [];
    const existingClients = await getOAuthClients();
    const existingClientIds = new Set(
      existingClients.map((c) => c.clientId).filter(Boolean)
    );

    const syncPromises = TRUSTED_CLIENTS.map(async (trustedClient) => {
      const redirectUris = [...trustedClient.redirectUris];

      const isExisting = existingClientIds.has(trustedClient.clientId);

      if (isExisting) {
        // Client already exists, update it directly to match trusted config
        auth.api.adminUpdateOAuthClient({
          body: {
            client_id: trustedClient.clientId,
            update: {
              client_name: trustedClient.name,
              type: trustedClient.type,
              redirect_uris: redirectUris
            }
          },
          headers: request.headers
        });

        results.push({
          clientId: trustedClient.clientId,
          action: 'updated',
          name: trustedClient.name
        });
      } else {
        // Client doesn't exist, create it using Better Auth API
        try {
          const tokenEndpointAuthMethod: 'client_secret_basic' | 'none' =
            trustedClient.clientSecret ? 'client_secret_basic' : 'none';

          // Use the new OAuth Provider's adminCreateOAuthClient endpoint
          const result = await auth.api.adminCreateOAuthClient({
            body: {
              redirect_uris: redirectUris,
              client_name: trustedClient.name,
              scope: 'openid profile email',
              enable_end_session: trustedClient.enable_end_session,
              token_endpoint_auth_method: tokenEndpointAuthMethod,
              grant_types: ['authorization_code'] as const,
              response_types: ['code'] as const,
              skip_consent: trustedClient.skipConsent
            },
            headers: request.headers
          });

          const clientId =
            result && 'client_id' in result ? result.client_id : null;
          const clientSecret =
            result && 'client_secret' in result
              ? (result.client_secret as string)
              : null;

          if (!clientId) {
            throw new Error('Failed to register OAuth application');
          }

          // If we have a specific trusted clientId and the registered clientId differs,
          // update the database to use the trusted clientId
          if (trustedClient.clientId && clientId !== trustedClient.clientId) {
            // Update the clientId and clientSecret to match trusted client config
            await changeOAuthClientId(
              clientId as string,
              trustedClient.clientId
            );
          }

          results.push({
            clientId: trustedClient.clientId,
            action: 'created',
            name: trustedClient.name,
            clientSecret: clientSecret ?? undefined
          });
        } catch (error) {
          // If Better Auth API fails, throw error since we can't create without it
          throw new Error(
            `Failed to create trusted client: ${trustedClient.name}. ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    });

    await Promise.all(syncPromises);

    return {
      success: true,
      results,
      total: results.length
    };
  }
);
