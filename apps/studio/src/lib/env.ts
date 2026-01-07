import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// import { env as authEnv } from "@voidhash/auth/env";

// No ImportMetaEnv type exists in "vite" and import.meta.env is always just `any` at runtime in Vite projects.
// The correct typing for Vite is typeof import.meta.env.
// The property 'env' *does* exist on `import.meta`, so those errors are likely caused by a misconfigured tsconfig or editor, but using the Vite documented approach is correct.

export const env = createEnv({
  client: {
    VITE_APP_API_BASE_URL: z.string(),
    VITE_APP_AUTH_BASE_URL: z.string(),
    VITE_APP_STUDIO_BASE_URL: z.string(),
  },
  clientPrefix: "VITE_",
  runtimeEnv: {
    ...process.env,
    ...import.meta.env,
  },
  server: {
    VOIDHASH_AUTH_CLIENT_ID: z.string(),
    VOIDHASH_AUTH_CLIENT_SECRET: z.string(),
  },
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
});
