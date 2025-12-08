import { Effect } from 'effect';
import { createPaywall } from './create-paywall';
import { deletePaywall } from './delete-paywall';
import { getPaywalls } from './get-paywalls';

export class PaywallService extends Effect.Service<PaywallService>()(
  'PaywallService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        createPaywall: yield* createPaywall,
        getPaywalls: yield* getPaywalls,
        deletePaywall: yield* deletePaywall
      } as const;
    })
  }
) {}
