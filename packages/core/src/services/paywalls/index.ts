import { Effect } from "effect";

import { createPaywall } from "./create-paywall";
import { deletePaywall } from "./delete-paywall";
import { getPaywallById } from "./get-paywall-by-id";
import { getPaywalls } from "./get-paywalls";
import { createEditToken, validateEditToken } from "./paywall-edit-token";

export class PaywallService extends Effect.Service<PaywallService>()(
  "PaywallService",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      return {
        createEditToken: yield* createEditToken,
        createPaywall: yield* createPaywall,
        deletePaywall: yield* deletePaywall,
        getPaywallById: yield* getPaywallById,
        getPaywalls: yield* getPaywalls,
        validateEditToken: yield* validateEditToken,
      } as const;
    }),
  }
) {}
