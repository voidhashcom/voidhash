import { Effect, Layer, Context } from "effect";

import { AUTOMATIC_EVENTS } from "../analytics/constants";
import { LifecycleAdapter, type LifecycleSubscription } from "./lifecycle-adapter";

/**
 * Wires raw platform lifecycle transitions to high-level analytics-style
 * events. Translates background/active transitions delivered by
 * `LifecycleAdapter` into `$app_backgrounded` and `$app_became_active`
 * callbacks which the caller is expected to forward to the analytics pipeline.
 */
export class LifecycleService extends Context.Service<LifecycleService>()(
  "rn-voidhash/LifecycleService",
  {
    make: Effect.gen(function* () {
      const adapter = yield* LifecycleAdapter;

      const setupAutomaticLifecycleEvents = (
        captureEvent: (eventName: string) => void
      ): Effect.Effect<LifecycleSubscription | null> =>
        adapter.subscribe((nextState, previousState) => {
          if (nextState === "background" && previousState !== "background") {
            captureEvent(AUTOMATIC_EVENTS.APP_BACKGROUNDED);
            return;
          }

          if (
            nextState === "active" &&
            previousState !== null &&
            previousState !== "active"
          ) {
            captureEvent(AUTOMATIC_EVENTS.APP_BECAME_ACTIVE);
          }
        });

      return { setupAutomaticLifecycleEvents } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make);
}
