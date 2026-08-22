import { VoidhashNodeConfigurationError, type VoidhashNodeClient } from "@voidhash/node";

import { createAnalytics } from "./analytics";
import { ConfigError, readConfig, type AppConfig } from "./config";
import { createEntitlementsCache } from "./entitlements-cache";
import { PRO_PERK_SLUG } from "./nimbus";
import { createNoteStore } from "./notes";
import { createCaptureEventRoute } from "./routes/events";
import { healthRoute } from "./routes/health";
import { createMeRoute } from "./routes/me";
import {
  createCreateNoteRoute,
  createExportNotesRoute,
  createListNotesRoute,
} from "./routes/notes";
import { createWebhookRoute } from "./routes/webhook";
import { createServer, type Route } from "./server";
import { createVoidhashClient } from "./voidhash";
import { createWebhookProcessor } from "./webhooks";

const die = (message: string): never => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

const loadConfig = (): AppConfig => {
  try {
    return readConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      return die(error.message);
    }

    throw error;
  }
};

/**
 * `createVoidhashSdk` validates eagerly, so a malformed base URL or a missing
 * global `fetch` surfaces here rather than on the first request.
 */
const loadClient = (config: AppConfig): VoidhashNodeClient => {
  try {
    return createVoidhashClient(config);
  } catch (error) {
    if (error instanceof VoidhashNodeConfigurationError) {
      return die(`Voidhash client configuration is invalid: ${error.message}`);
    }

    throw error;
  }
};

const main = (): void => {
  const config = loadConfig();
  const voidhash = loadClient(config);

  if (config.webhookSecret === undefined) {
    console.warn(
      "[nimbus] VOIDHASH_WEBHOOK_SECRET is not set — POST /webhooks/voidhash will answer 503.",
    );
  }

  const analytics = createAnalytics(voidhash);
  const notes = createNoteStore();
  const entitlements = createEntitlementsCache({ perkSlug: PRO_PERK_SLUG, voidhash });
  const processor = createWebhookProcessor({ entitlements, notes });

  const routes: ReadonlyArray<Route> = [
    { handler: healthRoute, method: "GET", path: "/health" },
    { handler: createMeRoute({ entitlements, notes, voidhash }), method: "GET", path: "/v1/me" },
    {
      handler: createListNotesRoute({ analytics, entitlements, notes }),
      method: "GET",
      path: "/v1/notes",
    },
    {
      handler: createCreateNoteRoute({ analytics, entitlements, notes }),
      method: "POST",
      path: "/v1/notes",
    },
    {
      handler: createExportNotesRoute({ analytics, entitlements, notes }),
      method: "GET",
      path: "/v1/notes/export",
    },
    { handler: createCaptureEventRoute({ analytics }), method: "POST", path: "/v1/events" },
    {
      handler: createWebhookRoute({ processor, secret: config.webhookSecret }),
      method: "POST",
      path: "/webhooks/voidhash",
    },
  ];

  const server = createServer(routes);

  server.listen(config.port, () => {
    console.log(`[nimbus] listening on http://localhost:${config.port}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      console.log(`\n[nimbus] ${signal} received — shutting down.`);
      server.close(() => {
        process.exit(0);
      });
    });
  }
};

main();
