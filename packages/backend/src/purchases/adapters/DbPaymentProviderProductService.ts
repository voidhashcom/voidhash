import {
  PaymentProviderProductOperationsLive,
  PaymentProviderProductService as CorePaymentProviderProductService,
  type PaymentProviderProductServiceShape,
} from "@voidhash/core-v2";
import { Context, Effect, Layer } from "effect";

import { PurchaseManagementPortsLive } from "./DbPaymentProviderManagementLive.ts";

export { PaymentProviderProductServiceError } from "@voidhash/core-v2";

const CorePaymentProviderProductLive = CorePaymentProviderProductService.layer.pipe(
  Layer.provide(
    PaymentProviderProductOperationsLive.pipe(Layer.provide(PurchaseManagementPortsLive)),
  ),
);

/**
 * Compatibility service for backend callers migrating to the core-v2
 * payment-provider product application service.
 */
export class PaymentProviderProductService extends Context.Service<
  PaymentProviderProductService,
  PaymentProviderProductServiceShape
>()("@voidhash/backend/purchases/PaymentProviderProductService") {
  static readonly layer = Layer.effect(
    PaymentProviderProductService,
    Effect.gen(function* () {
      return PaymentProviderProductService.of(yield* CorePaymentProviderProductService);
    }),
  ).pipe(Layer.provide(CorePaymentProviderProductLive));
}
