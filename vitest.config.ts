import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
	test: {
		workspace: ["packages/*", "apps/*"],
		env: loadEnv(mode, process.cwd(), ""),
	},
}));
