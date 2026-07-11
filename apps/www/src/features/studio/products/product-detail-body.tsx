"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@voidhash/ui";

import { ProductDetailAddPerkButton } from "./product-detail-add-perk-button";
import { ProductDetailAddProductButton } from "./product-detail-add-product-button";
import { ProductDetailPaymentProvidersEmptyState } from "./product-detail-payment-providers-empty-state";
import { ProductDetailPerksEmptyState } from "./product-detail-perks-empty-state";
import { ProductDetailPerkRecord } from "./product-detail-product-perk-record";
import { ProductDetailProviderProductRecord } from "./product-detail-provider-product-record";
import { PaymentProviderLogo } from "@/features/studio/projects/settings/payment-providers/payment-provider-logo";
import { paymentProviders } from "@/features/studio/lib/payment-providers/payment-providers";
import {
  listPaymentProviderConfigurationsOptions,
  listPerksOptions,
  listProductPerksByProductIdOptions,
  listProviderProductsByProductIdOptions,
} from "@/features/studio/lib/tanstack-query";

interface ProductDetailBodyProps {
  productId: string;
  projectId: string;
  organizationSlug: string;
  projectSlug: string;
}

/**
 * Renders the perks + payment provider sections for a product. Used both by the
 * standalone `/products/$id` route and inline inside the products master/detail
 * pane. Triggers Suspense via `useSuspenseQuery`; wrap in a boundary.
 */
export function ProductDetailBody({
  productId,
  projectId,
  organizationSlug,
  projectSlug,
}: ProductDetailBodyProps) {
  const { data: providerProducts } = useSuspenseQuery(
    listProviderProductsByProductIdOptions({ productId }),
  );

  const { data: paymentProviderConfigurations } = useSuspenseQuery(
    listPaymentProviderConfigurationsOptions({ projectId }),
  );

  const { data: perks } = useSuspenseQuery(listPerksOptions({ projectId }));

  const { data: productPerks } = useSuspenseQuery(
    listProductPerksByProductIdOptions({ productId }),
  );

  const enabledPaymentProviderConfigurations = (paymentProviderConfigurations ?? [])
    .map((paymentProviderConfiguration) => {
      const paymentProvider = paymentProviders.find(
        (paymentProvider) => paymentProvider.id === paymentProviderConfiguration.providerId,
      );

      if (!paymentProvider) {
        return null;
      }

      return {
        configuration: paymentProviderConfiguration,
        enabled: !!paymentProviderConfiguration && paymentProviderConfiguration.enabled,
        id: paymentProviderConfiguration.id,
        name: paymentProviderConfiguration.name,
        paymentProvider,
      };
    })
    .filter((paymentProviderConfiguration) => paymentProviderConfiguration !== null)
    .filter((paymentProviderConfiguration) => paymentProviderConfiguration.enabled);

  const perksWithoutProductPerks = (perks ?? []).filter(
    (perk) => !(productPerks ?? []).some((productPerk) => productPerk.perkId === perk.id),
  );

  return (
    <div className="space-y-16">
      <section>
        <h2 className="font-normal text-2xl tracking-right">Perks</h2>
        <p className="mt-2 text-muted-foreground">Configure what perks this product unlocks.</p>

        <div className="mt-8">
          {(productPerks ?? []).length === 0 && (
            <ProductDetailPerksEmptyState
              perks={perksWithoutProductPerks}
              productId={productId}
            />
          )}
          {(productPerks ?? []).length > 0 && (
            <Card className="gap-0 overflow-hidden pt-0 pb-0">
              <CardContent className="divide-y divide-border px-0">
                {productPerks?.map((productPerk) => (
                  <ProductDetailPerkRecord
                    key={productPerk.perkId}
                    perks={perks ?? []}
                    productPerk={productPerk}
                  />
                ))}
              </CardContent>

              <CardFooter className="flex items-baseline justify-between border-border border-t bg-background py-3 [.border-t]:pt-3">
                <ProductDetailAddPerkButton
                  perks={perksWithoutProductPerks}
                  productId={productId}
                  variant="secondary"
                />
              </CardFooter>
            </Card>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-normal text-2xl tracking-right">Payment Providers</h2>
        <p className="mt-2 text-muted-foreground">
          Sets up a relationship between this voidhash product and payment providers products.
        </p>

        <div className="mt-8 space-y-8">
          {enabledPaymentProviderConfigurations.length === 0 && (
            <ProductDetailPaymentProvidersEmptyState
              organizationSlug={organizationSlug}
              projectSlug={projectSlug}
            />
          )}
          {enabledPaymentProviderConfigurations.map((paymentProviderWithConfiguration) => {
            const matchingProviderProducts = (providerProducts ?? []).filter(
              (providerProduct) =>
                providerProduct.paymentProviderConfigurationId ===
                paymentProviderWithConfiguration.id,
            );

            return (
              <Card
                className="gap-0 overflow-hidden pb-0"
                key={paymentProviderWithConfiguration.paymentProvider.id}
              >
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-4">
                    <PaymentProviderLogo
                      className="h-5 w-5"
                      providerId={paymentProviderWithConfiguration.paymentProvider.id}
                    />
                    <span>{paymentProviderWithConfiguration.paymentProvider.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border border-border border-t px-0">
                  {matchingProviderProducts.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center py-6">
                      <div className="text-muted-foreground">
                        You haven&apos;t added any{" "}
                        {paymentProviderWithConfiguration.paymentProvider.title} product yet.
                      </div>
                      <div className="mt-4">
                        <ProductDetailAddProductButton
                          paymentProviderConfigurationId={paymentProviderWithConfiguration.id}
                          productId={productId}
                          providerId={paymentProviderWithConfiguration.paymentProvider.id}
                          title={paymentProviderWithConfiguration.paymentProvider.title}
                        />
                      </div>
                    </div>
                  )}

                  {matchingProviderProducts.map((providerProduct) => (
                    <ProductDetailProviderProductRecord
                      key={providerProduct.providerProductKey}
                      paymentProviderConfigurationId={paymentProviderWithConfiguration.id}
                      paymentProviderId={paymentProviderWithConfiguration.paymentProvider.id}
                      providerProduct={providerProduct}
                    />
                  ))}
                </CardContent>
                {matchingProviderProducts.length > 0 && (
                  <CardFooter className="flex items-baseline justify-between border-border border-t bg-background py-3 [.border-t]:pt-3">
                    <ProductDetailAddProductButton
                      paymentProviderConfigurationId={paymentProviderWithConfiguration.id}
                      productId={productId}
                      providerId={paymentProviderWithConfiguration.paymentProvider.id}
                      title={paymentProviderWithConfiguration.paymentProvider.title}
                      variant="secondary"
                    />
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
