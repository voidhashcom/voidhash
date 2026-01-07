import { Effect } from "effect";

import { cancelSubscription } from "./cancel-subscription";
import { createCheckoutSession } from "./create-checkout-session";
import { getOrganizationBilling } from "./get-organization-billing";
import { handleSubscriptionChange } from "./handle-subscription-change";
import { initializeOrganizationBilling } from "./initialize-organization-billing";

export class BillingService extends Effect.Service<BillingService>()(
  "BillingService",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      return {
        /**
         * Initialize billing for a new organization
         * Creates a local billing record and syncs with billing provider
         */
        initializeOrganizationBilling: yield* initializeOrganizationBilling,

        /**
         * Get billing info for an organization
         * Includes tier, subscription status, and usage summaries
         */
        getOrganizationBilling: yield* getOrganizationBilling,

        /**
         * Create a checkout session for upgrading to a paid tier
         */
        createCheckoutSession: yield* createCheckoutSession,

        /**
         * Handle subscription change event from webhook
         */
        handleSubscriptionChange: yield* handleSubscriptionChange,

        /**
         * Cancel an organization's subscription
         */
        cancelSubscription: yield* cancelSubscription,
      } as const;
    }),
  }
) {}
