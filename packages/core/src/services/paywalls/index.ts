import { Effect } from 'effect';
import { createPaywall } from './create-paywall';
import { deletePaywall } from './delete-paywall';
import { getPaywalls } from './get-paywalls';
import { createEditToken, validateEditToken } from './paywall-edit-token';

export class PaywallService extends Effect.Service<PaywallService>()(
  'PaywallService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        createPaywall: yield* createPaywall,
        getPaywalls: yield* getPaywalls,
        deletePaywall: yield* deletePaywall,
        createEditToken: yield* createEditToken,
        validateEditToken: yield* validateEditToken
      } as const;
    })
  }
) {}
