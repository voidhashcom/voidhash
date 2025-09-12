import { Badge } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { ServerComponent } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { PaymentProviderService } from '@/lib/services/payment-provider.service';
import { ProductService } from '@/lib/services/product.service';
import { PaymentProviderLogo } from '../projects/settings/payment-providers/payment-provider-logo';

export const _ProductRecordConfigurationStateIndicator = Effect.fn(
  'ProductRecordConfigurationStateIndicator'
)(function* ({
  productId,
  projectId
}: {
  productId: string;
  projectId: string;
}) {
  const data = yield* Effect.either(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const productService = yield* ProductService;
          const paymentProviderService = yield* PaymentProviderService;

          const [providerProducts, paymentProviderConfigurations] =
            yield* Effect.all(
              [
                productService.getProviderProductsByProductId(productId),
                paymentProviderService.getPaymentProviderConfigurations(
                  projectId
                )
              ],
              {
                concurrency: 'unbounded'
              }
            );
          return { providerProducts, paymentProviderConfigurations };
        })
      );
    })
  );

  if (Either.isLeft(data)) {
    return <Badge>Loading error</Badge>;
  }

  const { providerProducts, paymentProviderConfigurations } = data.right;

  if (providerProducts.length === 0) {
    return <Badge>Configuration required</Badge>;
  }

  if (paymentProviderConfigurations.length === 0) {
    return <Badge>Configuration required</Badge>;
  }

  return (
    <div className="flex flex-row items-center gap-3">
      {paymentProviderConfigurations
        .filter((f) => !!f.enabled)
        .map((paymentProviderConfiguration) => {
          return providerProducts.some(
            (providerProduct) =>
              providerProduct.paymentProviderConfigurationId ===
              paymentProviderConfiguration.id
          ) ? (
            <PaymentProviderLogo
              className="h-4 w-4"
              key={paymentProviderConfiguration.providerId}
              providerId={
                paymentProviderConfiguration.providerId as
                  | 'stripe'
                  | 'app-store'
              }
            />
          ) : null;
        })}
    </div>
  );
});

export const ProductRecordConfigurationStateIndicator = ServerComponent.build(
  _ProductRecordConfigurationStateIndicator
);
