import { createBetterAuthOptions } from '@voidhash/auth';
import type { Database } from '@voidhash/db';
import { betterAuth } from 'better-auth';

export const TRUSTED_CLIENT_IDS = new Set([
  process.env.VOIDHASH_STUDIO_CLIENT_ID as string,
  process.env.VOIDHASH_MOBILE_CLIENT_ID as string
]);

export const createBetterAuth = (db: Database) =>
  betterAuth({
    ...createBetterAuthOptions({
      db,
      baseURL: process.env.VOIDHASH_AUTH_BASE_URL as string,
      trustedClientIds: TRUSTED_CLIENT_IDS
    })
  });
