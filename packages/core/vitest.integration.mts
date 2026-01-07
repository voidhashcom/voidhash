import path from "node:path";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const envDir = path.join(process.cwd(), "../../apps/api");
const env = loadEnv("", envDir, "");

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		env,
		include: [
			"./src/services/**/*.integration.test.ts",
			"./src/payment-providers/**/*.integration.test.ts",
		],
		exclude: [
			"./src/payment-providers/core/process-subscription-cancellation.integration.test.ts",
			"./src/payment-providers/core/process-subscription-creation.integration.test.ts",
			"./src/payment-providers/core/process-subscription-refund.integration.test.ts",
			"./src/payment-providers/core/process-subscription-renewal.integration.test.ts",
		],
		pool: "threads",
		poolOptions: {
			threads: {
				singleThread: true,
			},
		},
		reporters: ["verbose"],
		teardownTimeout: 60_000,
		testTimeout: 60_000,
	},
});
