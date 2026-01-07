import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@voidhash/ui";
import { useAuth } from "src/components/auth-context";

import { ProductDetailAddPerkButton } from "@/features/products/product-detail-add-perk-button";
import { ProductDetailAddProductButton } from "@/features/products/product-detail-add-product-button";
import { ProductsDetailPageSkeleton } from "@/features/products/product-detail-page-skeleton";
import { ProductDetailPaymentProvidersEmptyState } from "@/features/products/product-detail-payment-providers-empty-state";
import { ProductDetailPerksEmptyState } from "@/features/products/product-detail-perks-empty-state";
import { ProductDetailPerkRecord } from "@/features/products/product-detail-product-perk-record";
import { ProductDetailProviderProductRecord } from "@/features/products/product-detail-provider-product-record";
import { PaymentProviderLogo } from "@/features/projects/settings/payment-providers/payment-provider-logo";
import { Page } from "@/features/shell";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import {
  getProductOptions,
  listPaymentProviderConfigurationsOptions,
  listPerksOptions,
  listProductPerksByProductIdOptions,
  listProviderProductsByProductIdOptions,
} from "@/lib/tanstack-query";
import { CurrentUser } from "@/lib/utils/current-user";

export const Route = createFileRoute(
  "/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/products/$id"
)({
  component: ProductDetailPage,
  errorComponent: ProductDetailPageError,
  pendingComponent: ProductDetailPageSkeleton,
});

function ProductDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the product",
      }}
    />
  );
}

function ProductDetailPageSkeleton() {
  return <ProductsDetailPageSkeleton />;
}

function ProductDetailPage() {
  const { id, organizationSlug, projectSlug } = Route.useParams();

  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: product } = useSuspenseQuery(
    getProductOptions({ productId: id as string })
  );

  const { data: providerProducts } = useSuspenseQuery(
    listProviderProductsByProductIdOptions({ productId: id as string })
  );

  const { data: paymentProviderConfigurations } = useSuspenseQuery(
    listPaymentProviderConfigurationsOptions({
      projectId: project.id,
    })
  );

  const { data: perks } = useSuspenseQuery(
    listPerksOptions({ projectId: project.id })
  );

  const { data: productPerks } = useSuspenseQuery(
    listProductPerksByProductIdOptions({ productId: id as string })
  );

  const enabledPaymentProviderConfigurations = (
    paymentProviderConfigurations ?? []
  )
    .map((paymentProviderConfiguration) => {
      const paymentProvider = paymentProviders.find(
        (paymentProvider) =>
          paymentProvider.id === paymentProviderConfiguration.providerId
      );

      if (!paymentProvider) {
        return null;
      }

      return {
        configuration: paymentProviderConfiguration,
        enabled:
          !!paymentProviderConfiguration &&
          paymentProviderConfiguration.enabled,
        id: paymentProviderConfiguration.id,
        name: paymentProviderConfiguration.name,
        paymentProvider,
      };
    })
    .filter(
      (paymentProviderConfiguration) => paymentProviderConfiguration !== null
    )
    .filter(
      (paymentProviderConfiguration) => paymentProviderConfiguration.enabled
    );

  const perksWithoutProductPerks = (perks ?? []).filter(
    (perk) =>
      !(productPerks ?? []).some(
        (productPerk) => productPerk.perkId === perk.id
      )
  );

  return (
    <Page
      breadcrumbs={[
        {
          title: "Products",
          url: `/${organizationSlug}/${projectSlug}/products`,
        },
        {
          title: product.name,
          url: `/${organizationSlug}/${projectSlug}/products/${id}`,
        },
      ]}
      className="p-0 py-8"
    >
      <div className="border-border border-b">
        <div className="mx-auto max-w-4xl pb-10">
          <div className="flex flex-row items-center justify-between">
            <h1 className="font-normal text-3xl tracking-right">
              {product.name}
            </h1>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-4xl">
        <div className="mt-8">
          <h2 className="font-normal text-2xl tracking-right">Perks</h2>
          <p className="mt-2 text-muted-foreground">
            Configure what perks this product unlocks.
          </p>

          <div className="mt-8">
            {(productPerks ?? []).length === 0 && (
              <ProductDetailPerksEmptyState
                perks={perksWithoutProductPerks}
                productId={product.id}
              />
            )}
            {(productPerks ?? []).length > 0 && (
              <Card className="mt-8 gap-0 overflow-hidden pt-0 pb-0">
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
                    productId={product.id}
                    variant="secondary"
                  />
                </CardFooter>
              </Card>
            )}
          </div>
        </div>
        <div className="mt-16">
          <h2 className="font-normal text-2xl tracking-right">
            Payment Providers
          </h2>
          <p className="mt-2 text-muted-foreground">
            Sets up a relationship between this voidhash product and payment
            providers products.
          </p>

          <div className="mt-8">
            {enabledPaymentProviderConfigurations.length === 0 && (
              <ProductDetailPaymentProvidersEmptyState
                organizationSlug={organizationSlug}
                projectSlug={projectSlug}
              />
            )}
            {enabledPaymentProviderConfigurations.map(
              (paymentProviderWithConfiguration) => (
                <Card
                  className="mt-8 gap-0 overflow-hidden pb-0"
                  key={paymentProviderWithConfiguration.paymentProvider.id}
                >
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-4">
                      <PaymentProviderLogo
                        className="h-5 w-5"
                        providerId={
                          paymentProviderWithConfiguration.paymentProvider.id
                        }
                      />
                      <span>
                        {paymentProviderWithConfiguration.paymentProvider.title}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border border-border border-t px-0">
                    {(providerProducts ?? []).filter(
                      (providerProduct) =>
                        providerProduct.paymentProviderConfigurationId ===
                        paymentProviderWithConfiguration.id
                    ).length === 0 && (
                      <div className="flex h-full flex-col items-center justify-center py-6">
                        <div className="text-muted-foreground">
                          You haven&apos;t added any{" "}
                          {
                            paymentProviderWithConfiguration.paymentProvider
                              .title
                          }{" "}
                          product yet.
                        </div>
                        <div className="mt-4">
                          <ProductDetailAddProductButton
                            paymentProviderConfigurationId={
                              paymentProviderWithConfiguration.id
                            }
                            productId={product.id}
                            providerId={
                              paymentProviderWithConfiguration.paymentProvider
                                .id
                            }
                            title={
                              paymentProviderWithConfiguration.paymentProvider
                                .title
                            }
                          />
                        </div>
                      </div>
                    )}

                    {(providerProducts ?? [])
                      .filter(
                        (providerProduct) =>
                          providerProduct.paymentProviderConfigurationId ===
                          paymentProviderWithConfiguration.id
                      )
                      .map((providerProduct) => (
                        <ProductDetailProviderProductRecord
                          key={providerProduct.providerProductKey}
                          paymentProviderConfigurationId={
                            paymentProviderWithConfiguration.id
                          }
                          paymentProviderId={
                            paymentProviderWithConfiguration.paymentProvider.id
                          }
                          providerProduct={providerProduct}
                        />
                      ))}
                  </CardContent>
                  {(providerProducts ?? []).some(
                    (providerProduct) =>
                      providerProduct.paymentProviderConfigurationId ===
                      paymentProviderWithConfiguration.id
                  ) && (
                    <CardFooter className="flex items-baseline justify-between border-border border-t bg-background py-3 [.border-t]:pt-3">
                      <ProductDetailAddProductButton
                        paymentProviderConfigurationId={
                          paymentProviderWithConfiguration.id
                        }
                        productId={product.id}
                        providerId={
                          paymentProviderWithConfiguration.paymentProvider.id
                        }
                        title={
                          paymentProviderWithConfiguration.paymentProvider.title
                        }
                        variant="secondary"
                      />
                    </CardFooter>
                  )}
                </Card>
              )
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
