import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["./**/*.test.ts"],
		exclude: ["./lib/api/v1/**"],
		reporters: ["html", "verbose"],
		outputFile: "./.vitest/html",
		alias: {
			"@/": new URL("./", import.meta.url).pathname,
		},
	},
});
