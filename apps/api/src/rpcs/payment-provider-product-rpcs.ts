import { PaymentProviderProductService } from '@voidhash/core/services';
import { PaymentProviderProductRpcsDef } from '@voidhash/rpc';
import { Effect, Layer } from 'effect';

export const PaymentProviderProductRpcsLive =
  PaymentProviderProductRpcsDef.toLayer(
    Effect.gen(function* () {
      const paymentProviderProductService =
        yield* PaymentProviderProductService;
      return {
        ListProviderProductsByProductId: ({ productId }) =>
          paymentProviderProductService.getProviderProductsByProductId(
            productId
          ),
        CreatePaymentProviderProduct: (input) =>
          paymentProviderProductService.createPaymentProviderProduct(input),
        UpdatePaymentProviderProduct: (input) =>
          paymentProviderProductService.updatePaymentProviderProduct(input),
        DeletePaymentProviderProduct: (input) =>
          paymentProviderProductService.deletePaymentProviderProduct(input),
        SetActivePaymentProviderProduct: (input) =>
          paymentProviderProductService.setActivePaymentProviderProduct(input)
      };
    })
  ).pipe(Layer.provide(PaymentProviderProductService.Default));
