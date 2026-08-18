import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { VoidhashV1Api } from "../packages/api-contracts/src/Api.ts";
import { EventCaptureApi } from "../packages/api-contracts/src/EventCapture.ts";
import { LinksApi } from "../packages/api-contracts/src/Links.ts";
import * as OpenApi from "effect/unstable/httpapi/OpenApi";

const root = resolve(import.meta.dirname, "..");

const writeSpec = (path: string, api: Parameters<typeof OpenApi.fromApi>[0]) => {
  writeFileSync(resolve(root, path), `${JSON.stringify(OpenApi.fromApi(api), null, 2)}\n`, "utf8");
};

writeSpec("packages/generated-clients/openapi/core.json", VoidhashV1Api);
writeSpec("packages/generated-clients/openapi/event-capture.json", EventCaptureApi);
writeSpec("packages/generated-clients/openapi/links.json", LinksApi);
