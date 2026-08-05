import { PaymentProviderProduct, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPaymentProviderProductServiceError,
} from "@voidhash/api-contracts/errors";
import { PaymentProviderProductService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const PaymentProviderProductsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "payment_provider_products",
  (handlers) =>
    Effect.gen(function* () {
      const service = yield* PaymentProviderProductService;

      return handlers.handle("listPaymentProviderProducts", () =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const products = yield* service.getProviderProductsByProjectId(projectId);

            return products.map(
              (p) =>
                new PaymentProviderProduct({
                  configuration: (p.configuration ?? {}) as Record<string, unknown>,
                  id: p.id,
                  paymentProviderConfigurationId: p.paymentProviderConfigurationId,
                  productId: p.productId,
                  providerId: p.providerId,
                }),
            );
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PaymentProviderProductServiceError: (e) =>
              Effect.fail(new ApiPaymentProviderProductServiceError({ cause: e.cause })),
          }),
        ),
      );
    }),
);
