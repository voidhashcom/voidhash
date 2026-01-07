import { z } from "zod";

export const integrationTestEnv = z.object({
  CI: z.coerce
    .string()
    .default("false")
    .transform((v) => v === "true"),
  DATABASE_HOST: z.string().min(1),
  DATABASE_NAME: z.string().optional(),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_USERNAME: z.string().min(1),
  E2E_BASE_URL: z.string().url().min(1),
});

export const env = integrationTestEnv.parse(process.env);
