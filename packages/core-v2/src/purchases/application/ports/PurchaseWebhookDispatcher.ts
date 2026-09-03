import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as EffectType from "effect/Effect";

import type { PurchasePortError } from "./PurchasePortError.ts";
import type { PurchaseWebhookDelivery } from "./PurchaseWebhookOutbox.ts";

export interface PurchaseWebhookDispatcherShape {
  /**
   * Starts delivery of rows the outbox already committed. Best effort: a row
   * whose dispatch is lost stays pending and is picked up by the delivery
   * sweep, so failures here never undo or delay the purchase transition.
   */
  readonly dispatch: (
    deliveries: ReadonlyArray<PurchaseWebhookDelivery>,
  ) => EffectType.Effect<void, PurchasePortError>;
}

/** Post-commit dispatcher for staged purchase lifecycle webhooks. */
export class PurchaseWebhookDispatcher extends Context.Service<
  PurchaseWebhookDispatcher,
  PurchaseWebhookDispatcherShape
>()("@voidhash/core-v2/purchases/PurchaseWebhookDispatcher") {
  static readonly noop = Layer.succeed(PurchaseWebhookDispatcher, {
    dispatch: () => Effect.void,
  });
}
