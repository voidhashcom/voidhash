import { PaywallService } from '@voidhash/core/services';
import { PaywallRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

export const PaywallRpcsLive = PaywallRpcsDef.toLayer(
  Effect.gen(function* () {
    const paywallService = yield* PaywallService;
    return {
      ListPaywalls: ({ projectId }) =>
        Effect.gen(function* () {
          return yield* paywallService.getPaywalls(projectId);
        }),
      CreatePaywall: (input) => paywallService.createPaywall(input),
      DeletePaywall: (input) => paywallService.deletePaywall(input),
      RequestPaywallEditToken: ({ paywallId }) =>
        paywallService.createEditToken(paywallId)
    };
  })
).pipe(Layer.provide(PaywallService.Default));
