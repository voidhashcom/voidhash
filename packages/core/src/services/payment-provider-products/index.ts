import { Effect } from "effect";

import { createPaymentProviderProduct } from "./create-payment-provider-product";
import { deletePaymentProviderProduct } from "./delete-payment-provider-product";
import { getProviderProductById } from "./get-provider-product-by-id";
import { getProviderProductsByProductId } from "./get-provider-products-by-product-id";
import { getProviderProductsByProjectId } from "./get-provider-products-by-project-id";
import { setActivePaymentProviderProduct } from "./set-active-payment-provider-product";
import { updatePaymentProviderProduct } from "./update-payment-provider-product";

export class PaymentProviderProductService extends Effect.Service<PaymentProviderProductService>()(
  "PaymentProviderProductService",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      return {
        createPaymentProviderProduct: yield* createPaymentProviderProduct,
        deletePaymentProviderProduct: yield* deletePaymentProviderProduct,
        getProviderProductById: yield* getProviderProductById,
        getProviderProductsByProductId: yield* getProviderProductsByProductId,
        getProviderProductsByProjectId: yield* getProviderProductsByProjectId,
        setActivePaymentProviderProduct: yield* setActivePaymentProviderProduct,
        updatePaymentProviderProduct: yield* updatePaymentProviderProduct,
      } as const;
    }),
  }
) {}
