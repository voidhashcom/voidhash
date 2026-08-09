import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  client: {
    VITE_APP_API_URL: z.string(),
    VITE_APP_ENV: z.enum(["development", "preview", "production"]).optional(),
  },
  clientPrefix: "VITE_",
  runtimeEnv: {
    ...process.env,
    ...import.meta.env,
  },
  server: {
    EMAIL_FROM: z.string().default("Voidhash <noreply@voidhash.com>"),
    RESEND_API_KEY: z.string().optional(),
  },
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
});
