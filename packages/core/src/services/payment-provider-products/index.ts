import { Effect } from 'effect';
import { createPaymentProviderProduct } from './create-payment-provider-product';
import { deletePaymentProviderProduct } from './delete-payment-provider-product';
import { getProviderProductById } from './get-provider-product-by-id';
import { getProviderProductsByProductId } from './get-provider-products-by-product-id';
import { setActivePaymentProviderProduct } from './set-active-payment-provider-product';
import { updatePaymentProviderProduct } from './update-payment-provider-product';

export class PaymentProviderProductService extends Effect.Service<PaymentProviderProductService>()(
  'PaymentProviderProductService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        createPaymentProviderProduct: yield* createPaymentProviderProduct,
        updatePaymentProviderProduct: yield* updatePaymentProviderProduct,
        setActivePaymentProviderProduct: yield* setActivePaymentProviderProduct,
        getProviderProductsByProductId: yield* getProviderProductsByProductId,
        getProviderProductById: yield* getProviderProductById,
        deletePaymentProviderProduct: yield* deletePaymentProviderProduct
      } as const;
    })
  }
) {}

