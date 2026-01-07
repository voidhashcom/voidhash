import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

// import { env as authEnv } from "@voidhash/auth/env";

// No ImportMetaEnv type exists in "vite" and import.meta.env is always just `any` at runtime in Vite projects.
// The correct typing for Vite is typeof import.meta.env.
// The property 'env' *does* exist on `import.meta`, so those errors are likely caused by a misconfigured tsconfig or editor, but using the Vite documented approach is correct.

export const env = createEnv({
  shared: {
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development')
  },
  client: {
    VITE_APP_AUTH_BASE_URL: z.string()
  },
  server: {
    DATABASE_HOST: z.string(),
    DATABASE_PORT: z.coerce.number().default(3306),
    DATABASE_USERNAME: z.string(),
    DATABASE_PASSWORD: z.string(),
    DATABASE_NAME: z.string(),

    // Trusted clients
    VOIDHASH_STUDIO_CLIENT_ID: z.string(),
    VOIDHASH_STUDIO_CLIENT_SECRET: z.string(),
    VOIDHASH_STUDIO_REDIRECT_URL: z.string(),
    VOIDHASH_MOBILE_CLIENT_ID: z.string(),
    VOIDHASH_MOBILE_CLIENT_SECRET: z.string(),

    // Email (Resend)
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default('Voidhash <noreply@voidhash.com>')
  },
  clientPrefix: 'VITE_',
  runtimeEnv: {
    ...process.env,
    ...import.meta.env
  }
});
