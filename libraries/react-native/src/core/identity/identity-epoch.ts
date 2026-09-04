import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";

/**
 * Monotonic counter of identity switches.
 *
 * A refresh that was already in flight when `identify()` or `reset()` landed
 * would otherwise write a snapshot belonging to the previous identity back into
 * the cache — the anonymous user's flags and grants reappearing under the
 * identified one. Every refresh reads the epoch before it starts and discards
 * its result if the epoch moved while it ran.
 *
 * It lives in its own service because `IdentityManager` depends on
 * `PersonInfoManager`, so the two cannot reference each other directly.
 */
const make = () =>
  Effect.sync(() => {
    const epoch = MutableRef.make(0);

    return {
      /** The epoch to compare a refresh result against before writing it back. */
      current: () => MutableRef.get(epoch),
      /** Invalidates every refresh that started before this call. */
      bump: () => MutableRef.set(epoch, MutableRef.get(epoch) + 1),
    } as const;
  });

export class IdentityEpoch extends Context.Service<
  IdentityEpoch,
  Effect.Success<ReturnType<typeof make>>
>()("rn-voidhash/IdentityEpoch") {
  static readonly layer = Layer.effect(IdentityEpoch, make());
}
