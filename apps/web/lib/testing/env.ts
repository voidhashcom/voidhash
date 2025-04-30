import { z } from "zod";

export const integrationTestEnv = z.object({
	E2E_BASE_URL: z.string().url().min(1),
	DATABASE_HOST: z.string().min(1),
	DATABASE_PORT: z.string().optional(),
	DATABASE_USERNAME: z.string().min(1),
	DATABASE_PASSWORD: z.string().min(1),
	DATABASE_NAME: z.string().optional(),
	CI: z.coerce
		.string()
		.default("false")
		.transform((v) => v === "true"),
});

export const env = integrationTestEnv.parse(process.env);
