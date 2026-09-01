import {
  constructWebhookEvent,
  VoidhashWebhookVerificationError,
  type VoidhashWebhookEvent,
} from "@voidhash/node";

import { readRawBody, sendJson } from "../http";
import type { RouteHandler } from "../server";
import type { WebhookProcessor } from "../webhooks";

export type WebhookRouteOptions = {
  /** Endpoint signing secret (`whsec_…`). The route answers 503 without one. */
  readonly secret: string | undefined;
  readonly processor: WebhookProcessor;
};

/**
 * `POST /webhooks/voidhash` — verify, acknowledge, then work.
 *
 * The signature covers the exact bytes Voidhash sent, so the body is read raw
 * and handed to `constructWebhookEvent` unparsed. This is the one place a web
 * framework usually gets in the way: `express.json()` (or any global body
 * parser) re-serializes the payload and every signature check fails. With
 * `node:http` the raw body is simply what you get.
 */
export const createWebhookRoute = (options: WebhookRouteOptions): RouteHandler => {
  const { processor, secret } = options;

  return async (request, response) => {
    if (secret === undefined) {
      sendJson(response, 503, { error: "webhook_secret_not_configured" });

      return;
    }

    const rawBody = await readRawBody(request);

    let event: VoidhashWebhookEvent;

    try {
      const headers: Record<string, string | string[]> = {};
      for (const [name, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers[name] = value;
      }
      event = constructWebhookEvent({ headers, payload: rawBody, secret });
    } catch (error) {
      if (error instanceof VoidhashWebhookVerificationError) {
        console.warn(`[webhook] rejected delivery: ${error.reason}`);
        sendJson(response, 400, { error: "invalid_webhook", reason: error.reason });

        return;
      }

      throw error;
    }

    // Acknowledge inside the 30s delivery budget, then do the work out of band.
    // A handler that answers late is retried, which is exactly why `process` is
    // idempotent.
    sendJson(response, 200, { received: true });

    await processor.process(event, rawBody).catch((error: unknown) => {
      console.error(`[webhook] handling ${event.type} failed.`, error);
    });
  };
};
