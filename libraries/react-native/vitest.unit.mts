import react from "@vitejs/plugin-react";
import { reactNative } from "@srsholmes/vitest-react-native";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths(), react(), reactNative()],
	test: {
		environment: "node",
		exclude: ["./node_modules/**", "./build/**", "./lib/**"],
		globals: false,
		include: ["./tests/**/*.test.{ts,tsx}"],
		reporters: ["verbose"],
		setupFiles: ["./vitest.setup.ts"],
	},
});
