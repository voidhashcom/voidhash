// vite.config.ts

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { BASE_PATH } from "./src/lib/basepath";

const ALLOWED_ORIGINS = [process.env.VITE_APP_AUTH_BASE_URL];

export default defineConfig({
	base: BASE_PATH,
	server: {
		port: 3001,
		cors: {
			origin: true,

			credentials: true,
		},
	},
	plugins: [
		tailwindcss(),
		// Enables Vite to resolve imports using path aliases.
		tsconfigPaths(),
		tanstackStart({
			srcDirectory: "src", // This is the default
			spa: {
				enabled: true,
				prerender: {
					outputPath: `${BASE_PATH}/_shell.html`,
					crawlLinks: true,
					retryCount: 3,
				},
			},
		}),
		viteReact(),
	],
});
