'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@voidhash/ui';
import {
  listPaymentProviderConfigurationsOptions,
  listProviderProductsByProductIdOptions
} from '@/lib/tanstack-query';
import { PaymentProviderLogo } from '../projects/settings/payment-providers/payment-provider-logo';

export function ProductRecordConfigurationStateIndicator({
  productId,
  projectId
}: {
  productId: string;
  projectId: string;
}) {
  const { data: providerProducts, status: providerProductsStatus } = useQuery({
    ...listProviderProductsByProductIdOptions({ productId }),
    enabled: !!productId
  });

  const {
    data: paymentProviderConfigurations,
    status: paymentProviderConfigurationsStatus
  } = useQuery({
    ...listPaymentProviderConfigurationsOptions({ projectId }),
    enabled: !!projectId
  });

  if (
    providerProductsStatus === 'error' ||
    paymentProviderConfigurationsStatus === 'error'
  ) {
    return <Badge>Loading error</Badge>;
  }

  if (
    providerProductsStatus === 'pending' ||
    paymentProviderConfigurationsStatus === 'pending'
  ) {
    return <Badge>Loading...</Badge>;
  }

  if (!providerProducts || providerProducts.length === 0) {
    return <Badge>Configuration required</Badge>;
  }

  if (
    !paymentProviderConfigurations ||
    paymentProviderConfigurations.length === 0
  ) {
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
                  | 'apple-app-store'
              }
            />
          ) : null;
        })}
    </div>
  );
}
