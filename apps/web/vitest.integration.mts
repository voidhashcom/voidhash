import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["./lib/api/v1/**/*.test.ts"],
		reporters: ["html", "verbose"],
		outputFile: "./.vitest/html",
		alias: {
			"@/": new URL("./", import.meta.url).pathname,
		},
		pool: "threads",
		poolOptions: {
			threads: {
				singleThread: true,
			},
		},
		testTimeout: 60_000,
		teardownTimeout: 60_000,
	},
});
