import { defineConfig } from "vite";

import { paywallRuntimeBundlePlugin } from "./src/vite-plugin";

export default defineConfig({
  plugins: [paywallRuntimeBundlePlugin()],
});
