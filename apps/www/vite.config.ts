import { defineVoidhashWebConfig } from "@voidhash/web-app/vite";

import * as sourceConfig from "./src/features/source.config.ts";

export default defineVoidhashWebConfig({
  appRoot: new URL("./", import.meta.url),
  composition: {
    authBrowser: new URL(
      "../../packages/web-app/src/composition/community/auth-browser.ts",
      import.meta.url,
    ),
    authServer: new URL(
      "../../packages/web-app/src/composition/community/auth-server.ts",
      import.meta.url,
    ),
    edition: new URL(
      "../../packages/web-app/src/composition/community/edition.ts",
      import.meta.url,
    ),
    globals: new URL("../../packages/web-app/src/styles/globals.css", import.meta.url),
  },
  routeDirectories: [
    new URL("../../packages/web-app/src/routes/shared/", import.meta.url),
    new URL("../../packages/web-app/src/routes/community/", import.meta.url),
  ],
  sourceConfig,
  workspaceRoot: new URL("../../", import.meta.url),
});
