import { resolve } from "node:path";

import { createStudioViteConfig } from "./src/server/config";

/**
 * Vite config for Studio. The project to preview is chosen by the
 * `VOIDHASH_PROJECT_ROOT` env var, which `voidhash-cli studio` sets when it
 * launches Vite. When run standalone (`pnpm --filter @voidhash/studio dev`) it
 * falls back to the bundled React Native example so Studio can be developed in
 * isolation.
 */
const projectRoot =
  process.env.VOIDHASH_PROJECT_ROOT ??
  resolve(import.meta.dirname, "../../examples/react-native-example");

export default createStudioViteConfig({
  projectRoot,
  studioRoot: import.meta.dirname,
});
