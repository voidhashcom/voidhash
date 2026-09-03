import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import type * as EffectType from "effect/Effect";

import type { WebhookLifecycleEvent } from "../../processing/domain/WebhookEventMapper.ts";
import type { PurchasePortError } from "./PurchasePortError.ts";

/** One lifecycle event addressed to a project's subscribed webhook endpoints. */
export interface PurchaseEventPublication {
  readonly eventType: WebhookLifecycleEvent["eventType"];
  readonly payload: object;
  readonly projectId: string;
}

/**
 * A delivery row the outbox persisted for one endpoint. Everything the
 * delivery workflow needs travels with it so dispatch never re-reads state
 * that may not be committed yet.
 */
export const PurchaseWebhookDelivery = Schema.Struct({
  deliveryId: Schema.NonEmptyString,
  endpointId: Schema.NonEmptyString,
  eventType: Schema.NonEmptyString,
  payload: Schema.Unknown,
  url: Schema.NonEmptyString,
});
export type PurchaseWebhookDelivery = typeof PurchaseWebhookDelivery.Type;

export interface PurchaseWebhookOutboxShape {
  /**
   * Writes one delivery row per subscribed endpoint on the caller's
   * transaction so the announcement commits, or rolls back, together with the
   * state transition that produced it. Returns the rows to dispatch after
   * commit.
   */
  readonly stage: (
    event: PurchaseEventPublication,
  ) => EffectType.Effect<ReadonlyArray<PurchaseWebhookDelivery>, PurchasePortError>;
}

/** Transaction-bound outbox for purchase lifecycle webhooks. */
export class PurchaseWebhookOutbox extends Context.Service<
  PurchaseWebhookOutbox,
  PurchaseWebhookOutboxShape
>()("@voidhash/core-v2/purchases/PurchaseWebhookOutbox") {
  static readonly noop = Layer.succeed(PurchaseWebhookOutbox, {
    stage: () => Effect.succeed([]),
  });
}
