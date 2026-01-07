import { PaywallService } from "@voidhash/core/services";
import { PaywallRpcsDef } from "@voidhash/rpc";
import { Effect, Layer } from "effect";

export const PaywallRpcsLive = PaywallRpcsDef.toLayer(
  Effect.gen(function* PaywallRpcsLive() {
    const paywallService = yield* PaywallService;
    return {
      CreatePaywall: (input) => paywallService.createPaywall(input),
      DeletePaywall: (input) => paywallService.deletePaywall(input),
      ListPaywalls: ({ projectId }) =>
        Effect.gen(function* ListPaywalls() {
          return yield* paywallService.getPaywalls(projectId);
        }),
      RequestPaywallEditToken: ({ paywallId }) =>
        paywallService.createEditToken(paywallId),
    };
  })
).pipe(Layer.provide(PaywallService.Default));
