import { Effect } from 'effect';
import { cancelPurchase } from './actions/cancel-purchase';
import { confirmPurchase } from './actions/confirm-purchase';

export class DevCheckoutService extends Effect.Service<DevCheckoutService>()(
  'DevCheckoutService',
  {
    effect: Effect.succeed({
      confirmPurchase,
      cancelPurchase
    }),

    // Specify dependencies
    dependencies: []
  }
) {}
