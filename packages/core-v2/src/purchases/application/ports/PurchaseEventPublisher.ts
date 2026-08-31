import { Context, Effect, Layer, type Effect as EffectType } from "effect";

import type { WebhookLifecycleEvent } from "../../processing/domain/WebhookEventMapper.ts";
import type { PurchasePortError } from "./PurchasePortError.ts";

export interface PurchaseEventPublication {
  readonly eventType: WebhookLifecycleEvent["eventType"];
  readonly payload: object;
  readonly projectId: string;
}

export interface PurchaseEventPublisherShape {
  readonly publish: (event: PurchaseEventPublication) => EffectType.Effect<void, PurchasePortError>;
}

/** Post-commit purchase lifecycle event publisher. */
export class PurchaseEventPublisher extends Context.Service<
  PurchaseEventPublisher,
  PurchaseEventPublisherShape
>()("@voidhash/core-v2/purchases/PurchaseEventPublisher") {
  static readonly noop = Layer.succeed(PurchaseEventPublisher, {
    publish: () => Effect.void,
  });
}
