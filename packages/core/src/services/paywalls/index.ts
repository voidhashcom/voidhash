import { Effect } from "effect";

import { createPaywall } from "./create-paywall";
import { deletePaywall } from "./delete-paywall";
import { getPaywallById } from "./get-paywall-by-id";
import { getPaywalls } from "./get-paywalls";
import { createEditToken, validateEditToken } from "./paywall-edit-token";
import {
  getPublishedVersions,
  publishPaywall,
  setActiveVersion,
} from "./publish-paywall";

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
        getPublishedVersions: yield* getPublishedVersions,
        publishPaywall: yield* publishPaywall,
        setActiveVersion: yield* setActiveVersion,
        validateEditToken: yield* validateEditToken,
      } as const;
    }),
  }
) {}
