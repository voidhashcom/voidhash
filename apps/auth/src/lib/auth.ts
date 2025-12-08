import { createBetterAuthOptions } from '@voidhash/auth';
import { db } from '@voidhash/db';
import { betterAuth } from 'better-auth';

export const auth = betterAuth(createBetterAuthOptions(db, 'tanstack-start'));
