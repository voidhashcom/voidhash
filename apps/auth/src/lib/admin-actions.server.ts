import { db, oauthClient } from '@voidhash/db';

import { eq } from 'drizzle-orm';

export async function getOAuthClients() {
  const clients = await db.select().from(oauthClient);
  return clients;
}

export async function getOAuthClient(clientId: string) {
  const [client] = await db
    .select()
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
    .limit(1);
  return client;
}

export async function changeOAuthClientId(
  clientId: string,
  newClientId: string
) {
  await db
    .update(oauthClient)
    .set({
      clientId: newClientId,
      updatedAt: new Date()
    })
    .where(eq(oauthClient.clientId, clientId));
}

export async function deleteOAuthClient(clientId: string) {
  await db.delete(oauthClient).where(eq(oauthClient.clientId, clientId));
}
