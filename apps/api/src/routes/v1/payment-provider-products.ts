import { HttpApiBuilder } from "@effect/platform";
import { VoidhashV1Api } from "@voidhash/api-spec";
import { PaymentProviderProductService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/shared";
import { Effect } from "effect";

export const PaymentProviderProductsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "payment_provider_products",
  (handlers) =>
    Effect.gen(function* PaymentProviderProductsGroupLive() {
      const service = yield* PaymentProviderProductService;

      return handlers.handle("listPaymentProviderProducts", () =>
        Effect.gen(function* listPaymentProviderProducts() {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);
          const products =
            yield* service.getProviderProductsByProjectId(projectId);

          // Map to API response format
          return products.map((p) => ({
            configuration: (p.configuration ?? {}) as Record<string, unknown>,
            id: p.id,
            paymentProviderConfigurationId: p.paymentProviderConfigurationId,
            productId: p.productId,
            providerId: p.providerId,
          }));
        })
      );
    })
);
