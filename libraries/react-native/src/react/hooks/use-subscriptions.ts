import type { Subscription } from "../../core/entities/person";
import type { UseCurrentPersonResult } from "./use-person";

export interface UseSubscriptionsResult extends Omit<UseCurrentPersonResult, "data"> {
  /**
   * Every subscription of the person that has not ended, including ones in a
   * grace period, in billing retry, on hold or paused: what a "manage
   * subscription" screen lists. Empty until the person loads. Access comes
   * from entitlements (`useHasPerk`), never from this list.
   */
  readonly all: ReadonlyArray<Subscription>;
  /** The subscription that matters most now, or `undefined` when there is none. */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
  readonly current: Subscription | undefined;
}

const NO_SUBSCRIPTIONS: ReadonlyArray<Subscription> = [];

export function subscriptionsHookFactory(useCurrentPerson: () => UseCurrentPersonResult) {
  /**
   * The person's subscriptions as the server knows them across devices and
   * stores: renewal, grace period, billing retry, hold, pause and pending
   * changes. Re-renders with the person, as `useCurrentPerson()` does.
   */
  function useSubscriptions(): UseSubscriptionsResult {
    const { data: person, ...state } = useCurrentPerson();
    return {
      ...state,
      all: person?.subscriptions.all ?? NO_SUBSCRIPTIONS,
      current: person?.subscriptions.current,
    };
  }
  return useSubscriptions;
}
