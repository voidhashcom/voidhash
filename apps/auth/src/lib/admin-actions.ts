import { db } from '@voidhash/db';
import { oauthApplication } from '@voidhash/db/schema';
import { eq } from 'drizzle-orm';

export async function getOAuthClients() {
  const clients = await db.select().from(oauthApplication);
  return clients;
}

export async function getOAuthClient(clientId: string) {
  const [client] = await db
    .select()
    .from(oauthApplication)
    .where(eq(oauthApplication.clientId, clientId))
    .limit(1);
  return client;
}

export async function updateOAuthClient(
  clientId: string,
  updates: {
    name?: string;
    redirectUris?: string;
    disabled?: boolean;
    type?: string;
    clientId?: string;
    clientSecret?: string;
  }
) {
  // Map redirectUris to redirectUrls for the database (schema uses redirectUrls)
  const { redirectUris, ...rest } = updates;
  const dbUpdates: Record<string, unknown> = { ...rest };
  if (redirectUris !== undefined) {
    dbUpdates.redirectUrls = redirectUris;
  }

  const [updated] = await db
    .update(oauthApplication)
    .set({
      ...dbUpdates,
      updatedAt: new Date()
    })
    .where(eq(oauthApplication.clientId, clientId))
    .limit(1);
  return updated;
}

export async function deleteOAuthClient(clientId: string) {
  await db
    .delete(oauthApplication)
    .where(eq(oauthApplication.clientId, clientId));
}
