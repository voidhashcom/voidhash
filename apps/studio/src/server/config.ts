import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { InlineConfig } from "vite";

import { voidhashPaywallsPlugin } from "./virtual-paywalls-plugin";

/**
 * Absolute path to the Studio app root (the folder containing `index.html`).
 * Resolved through `URL` rather than `node:path`; the trailing separator a
 * directory URL carries is trimmed so the value stays a plain directory path.
 */
export const STUDIO_ROOT = fileURLToPath(new URL("../..", import.meta.url)).replace(/[/\\]$/, "");

export interface StudioViteConfigOptions {
  /** The user's project root (folder containing `.voidhash`). */
  projectRoot: string;
  /** Studio app root. Defaults to {@link STUDIO_ROOT}. */
  studioRoot?: string;
  /** Dev server port. */
  port?: number;
}

/**
 * Builds the Vite config that powers Studio. It is shared by the standalone
 * `vite` dev script (see `vite.config.ts`) and the CLI's programmatic launch
 * (`startStudio`), so both render the user's paywalls identically.
 *
 * Key choices:
 * - `dedupe` forces a single copy of React and `@voidhash/paywalls`, so the
 *   paywall's primitives and Studio's `PaywallRenderer` share one renderer/
 *   runtime context even though they're imported from different places.
 * - The paywalls plugin contributes `server.fs.allow` for the project root.
 */
export const createStudioViteConfig = ({
  projectRoot,
  studioRoot = STUDIO_ROOT,
  port,
}: StudioViteConfigOptions): InlineConfig => ({
  configFile: false,
  root: studioRoot,
  plugins: [voidhashPaywallsPlugin({ projectRoot }), react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom", "@voidhash/paywalls"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client"],
  },
  server: {
    port,
    fs: { allow: [studioRoot, projectRoot] },
  },
});
