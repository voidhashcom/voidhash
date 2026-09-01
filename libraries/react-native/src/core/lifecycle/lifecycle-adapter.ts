import type * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import type * as Option from "effect/Option";

export interface LifecycleSubscription {
  readonly remove: () => void;
}

/**
 * Bridge to the host platform's app-lifecycle events. Implementations subscribe
 * to native state-change events (foreground/background/inactive) and forward
 * the raw transitions to the listener. The listener receives both the next
 * state and the previously observed state so it can compute meaningful
 * transitions (e.g. "became active" only fires when coming from non-active).
 *
 * Implementations return `null` when the platform doesn't expose lifecycle
 * events (e.g. unit-test environments without React Native installed).
 */
export class LifecycleAdapter extends Context.Service<
  LifecycleAdapter,
  {
    readonly subscribe: (
      listener: (nextState: string, previousState: Option.Option<string>) => void,
    ) => Effect.Effect<Option.Option<LifecycleSubscription>>;
  }
>()("rn-voidhash/LifecycleAdapter") {}
