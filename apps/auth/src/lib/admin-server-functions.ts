import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import {
  deleteOAuthClient,
  getOAuthClient,
  getOAuthClients,
  updateOAuthClient
} from './admin-actions';
import { auth, TRUSTED_CLIENTS } from './auth';

const UpdateClientSchema = z.object({
  name: z.string().optional(),
  redirectUrls: z.string().optional(),
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

    return getOAuthClients();
  }
);

// Get a specific OAuth client
export const getAdminClient = createServerFn({ method: 'GET' })
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

    const client = await getOAuthClient(data.clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    return client;
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

    await updateOAuthClient(data.clientId, data.updates);
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
    }> = [];
    const existingClients = await getOAuthClients();
    const existingClientIds = new Set(
      existingClients.map((c) => c.clientId).filter(Boolean)
    );

    const syncPromises = TRUSTED_CLIENTS.map(async (trustedClient) => {
      const redirectUrls = Array.isArray(trustedClient.redirectUrls)
        ? [...trustedClient.redirectUrls]
        : [trustedClient.redirectUrls];

      const isExisting = existingClientIds.has(trustedClient.clientId);

      if (isExisting) {
        // Client already exists, update it directly to match trusted config
        await updateOAuthClient(trustedClient.clientId, {
          name: trustedClient.name,
          type: trustedClient.type,
          redirectUrls: redirectUrls.join(','),
          disabled: trustedClient.disabled ?? false,
          clientSecret: trustedClient.clientSecret
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

          const result = await auth.api.registerOAuthApplication({
            body: {
              redirect_uris: redirectUrls,
              client_name: trustedClient.name,
              scope: 'openid profile email',
              token_endpoint_auth_method: tokenEndpointAuthMethod,
              grant_types: ['authorization_code'] as 'authorization_code'[],
              response_types: ['code'] as 'code'[],
              metadata: trustedClient.metadata ?? undefined
            },
            headers: request.headers
          });

          if (!result?.client_id) {
            throw new Error('Failed to register OAuth application');
          }

          // If we have a specific trusted clientId and the registered clientId differs,
          // update the database to use the trusted clientId
          if (
            trustedClient.clientId &&
            result.client_id !== trustedClient.clientId
          ) {
            // Update the clientId and clientSecret to match trusted client config
            await updateOAuthClient(result.client_id, {
              clientId: trustedClient.clientId,
              clientSecret: trustedClient.clientSecret,
              name: trustedClient.name,
              type: trustedClient.type,
              redirectUrls: redirectUrls.join(','),
              disabled: trustedClient.disabled ?? false
            });
          }

          results.push({
            clientId: trustedClient.clientId,
            action: 'created',
            name: trustedClient.name
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
