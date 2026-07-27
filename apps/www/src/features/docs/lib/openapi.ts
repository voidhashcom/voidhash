import { createOpenAPI } from "fumadocs-openapi/server";

import { DOCS_PATH } from "@/lib/paths";

/**
 * OpenAPI server backing the API Reference tab. It reads the committed spec
 * snapshots (refreshed from the live backend by `scripts/generate-openapi.ts`)
 * and powers both the build-time page generation and the interactive
 * playground. `proxyUrl` routes "try it" requests through our own origin to
 * avoid CORS (see `src/routes/docs/api/proxy.ts`).
 */
export const openapi = createOpenAPI({
  input: [
    "./src/features/docs/openapi/voidhash-v1.json",
    "./src/features/docs/openapi/event-capture.json",
  ],
  proxyUrl: `${DOCS_PATH}/api/proxy`,
});
