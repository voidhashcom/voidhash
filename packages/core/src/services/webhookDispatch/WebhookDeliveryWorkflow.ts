import { Context, type Effect } from "effect";

/** Durable delivery request for a single webhook attempt. */
export interface DeliverWebhookInput {
  readonly deliveryId: string;
  readonly endpointId: string;
  readonly attemptNumber: number;
  readonly eventType: string;
  readonly payload: unknown;
  readonly secret: string;
  readonly url: string;
}

/**
 * Abstract webhook-delivery workflow. `dispatch` hands a delivery off to the
 * durable retry mechanism fire-and-forget; the concrete adapter (a Cloudflare
 * Workflow) is wired at the application root, so `packages/core` carries no
 * infrastructure dependency. Consumers fork the returned effect — failures are
 * the delivery mechanism's concern, never the caller's.
 */
export class WebhookDeliveryWorkflow extends Context.Service<
  WebhookDeliveryWorkflow,
  {
    readonly dispatch: (input: DeliverWebhookInput) => Effect.Effect<void>;
  }
>()("WebhookDeliveryWorkflow") {}
