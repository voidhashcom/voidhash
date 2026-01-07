import { PaymentProviderProductService } from "@voidhash/core/services";
import { PaymentProviderProductRpcsDef } from "@voidhash/rpc";
import { Effect, Layer } from "effect";

export const PaymentProviderProductRpcsLive =
  PaymentProviderProductRpcsDef.toLayer(
    Effect.gen(function* PaymentProviderProductRpcsLive() {
      const paymentProviderProductService =
        yield* PaymentProviderProductService;
      return {
        CreatePaymentProviderProduct: (input) =>
          paymentProviderProductService.createPaymentProviderProduct(input),
        DeletePaymentProviderProduct: (input) =>
          paymentProviderProductService.deletePaymentProviderProduct(input),
        ListProviderProductsByProductId: ({ productId }) =>
          paymentProviderProductService.getProviderProductsByProductId(
            productId
          ),
        SetActivePaymentProviderProduct: (input) =>
          paymentProviderProductService.setActivePaymentProviderProduct(input),
        UpdatePaymentProviderProduct: (input) =>
          paymentProviderProductService.updatePaymentProviderProduct(input),
      };
    })
  ).pipe(Layer.provide(PaymentProviderProductService.Default));
