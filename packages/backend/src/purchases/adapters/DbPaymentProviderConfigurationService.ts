import {
  PaymentProviderConfigurationOperationsLive,
  PaymentProviderConfigurationService as CorePaymentProviderConfigurationService,
  type PaymentProviderConfigurationServiceShape,
} from "@voidhash/core-v2";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { PurchaseManagementPortsLive } from "./DbPaymentProviderManagementLive.ts";

export { PaymentProviderConfigurationServiceError } from "@voidhash/core-v2";

const CorePaymentProviderConfigurationLive = CorePaymentProviderConfigurationService.layer.pipe(
  Layer.provide(
    PaymentProviderConfigurationOperationsLive.pipe(Layer.provide(PurchaseManagementPortsLive)),
  ),
);

/**
 * Compatibility service for backend callers migrating to the core-v2
 * payment-provider configuration application service.
 */
export class PaymentProviderConfigurationService extends Context.Service<
  PaymentProviderConfigurationService,
  PaymentProviderConfigurationServiceShape
>()("@voidhash/backend/purchases/PaymentProviderConfigurationService") {
  static readonly layer = Layer.effect(
    PaymentProviderConfigurationService,
    Effect.gen(function* () {
      return PaymentProviderConfigurationService.of(yield* CorePaymentProviderConfigurationService);
    }),
  ).pipe(Layer.provide(CorePaymentProviderConfigurationLive));
}
