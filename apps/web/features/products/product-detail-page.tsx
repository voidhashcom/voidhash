import { Environment as EnvironmentEnum } from '@voidhash/lib/index';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { NotFoundError } from '@/lib/effect/errors';
import {
  encodeNextjsErrorResponse,
  HandleCommonErrors,
  ServerComponent
} from '@/lib/effect/runtimes/nextjs';
import { paymentProviders } from '@/lib/payment-providers/payment-providers';
import { authenticateWithSession } from '@/lib/services/auth.service';
import {
  Environment,
  withEnvironmentFromCookie
} from '@/lib/services/environment.service';
import { PaymentProviderService } from '@/lib/services/payment-provider.service';
import { PerkService } from '@/lib/services/perk.service';
import { ProductService } from '@/lib/services/product.service';
import { ProjectService } from '@/lib/services/project.service';
import { PaymentProviderLogo } from '../projects/settings/payment-providers/payment-provider-logo';
import { ProductDetailAddPerkButton } from './product-detail-add-perk-button';
import { ProductDetailAddProductButton } from './product-detail-add-product-button';
import { ProductDetailPaymentProvidersEmptyState } from './product-detail-payment-providers-empty-state';
import { ProductDetailPerksEmptyState } from './product-detail-perks-empty-state';
import { ProductDetailPerkRecord } from './product-detail-product-perk-record';
import { ProductDetailProviderProductRecord } from './product-detail-provider-product-record';

export const _ProductDetailPage = Effect.fn('ProductDetailPage')(function* ({
  organizationSlug,
  projectSlug,
  id
}: {
  organizationSlug: string;
  projectSlug: string;
  id: string;
}) {
  const data = yield* Effect.either(
    authenticateWithSession(
      withEnvironmentFromCookie({ organizationSlug, projectSlug })(
        Effect.gen(function* () {
          const productService = yield* ProductService;
          const paymentProviderService = yield* PaymentProviderService;
          const perkService = yield* PerkService;
          const environment = yield* Environment;
          const projectService = yield* ProjectService;

          const project =
            yield* projectService.getProjectBySlugAndOrganizationSlug({
              organizationSlug,
              projectSlug
            });

          if (!project) {
            return yield* Effect.fail(
              new NotFoundError({
                message: 'Project not found'
              })
            );
          }

          const [
            product,
            providerProducts,
            paymentProviderConfigurations,
            perks,
            productPerks
          ] = yield* Effect.all(
            [
              productService.getProductById(id),
              productService.getProviderProductsByProductId(id),
              paymentProviderService.getPaymentProviderConfigurations(
                project.id
              ),
              perkService.getPerks(project.id),
              productService.getProductPerksByProductId(id)
            ],
            {
              concurrency: 'unbounded'
            }
          );

          return {
            product,
            providerProducts,
            paymentProviderConfigurations,
            environment,
            perks,
            productPerks
          };
        })
      )
    ).pipe(HandleCommonErrors)
  );

  if (Either.isLeft(data)) {
    const error = data.left;
    return <VoidhashErrorCard error={encodeNextjsErrorResponse(error)} />;
  }

  const {
    product,
    providerProducts,
    paymentProviderConfigurations,
    environment,
    perks,
    productPerks
  } = data.right;

  const enabledPaymentProviderConfigurations = paymentProviderConfigurations
    .map((paymentProviderConfiguration) => {
      const paymentProvider = paymentProviders.find(
        (paymentProvider) =>
          paymentProvider.getId() === paymentProviderConfiguration.providerId
      );

      if (!paymentProvider) {
        return null;
      }

      return {
        paymentProvider,
        id: paymentProviderConfiguration.id,
        name: paymentProviderConfiguration.name,
        enabled:
          !!paymentProviderConfiguration &&
          paymentProviderConfiguration.enabled,
        configuration: paymentProviderConfiguration
      };
    })
    .filter(
      (paymentProviderConfiguration) => paymentProviderConfiguration !== null
    )
    .filter(
      (paymentProviderConfiguration) =>
        paymentProviderConfiguration.paymentProvider.getIsProductConfigurable() &&
        paymentProviderConfiguration.enabled
    );

  const perksWithoutProductPerks = perks.filter(
    (perk) =>
      !productPerks.some((productPerk) => productPerk.perkId === perk.id)
  );

  return (
    <Page
      breadcrumbs={[
        {
          title: 'Products',
          url: `/${organizationSlug}/${projectSlug}/products`
        },
        {
          title: product.name,
          url: `/${organizationSlug}/${projectSlug}/products/${id}`
        }
      ]}
      className="p-0 py-8"
    >
      {/* Key is used to reload the default form data when the organization slug changes */}
      <div className="border-border border-b">
        <div className="mx-auto max-w-4xl pb-10">
          <div className="flex flex-row items-center justify-between">
            <h1 className="font-normal text-3xl tracking-right">
              {product.name}
            </h1>
            {/* <CreateProductModalButton projectId={project.id} /> */}
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
            {productPerks.length === 0 && (
              <ProductDetailPerksEmptyState
                perks={perksWithoutProductPerks}
                productId={product.id}
              />
            )}
            {productPerks.length > 0 && (
              <Card className="mt-8 gap-0 overflow-hidden pt-0 pb-0">
                <CardContent className="divide-y divide-border px-0">
                  {productPerks.map((productPerk) => (
                    <ProductDetailPerkRecord
                      key={productPerk.perkId}
                      perks={perks}
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
        {environment !== EnvironmentEnum.Testing && (
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
                    key={paymentProviderWithConfiguration.paymentProvider.getId()}
                  >
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-4">
                        <PaymentProviderLogo
                          className="h-5 w-5"
                          providerId={paymentProviderWithConfiguration.paymentProvider.getId()}
                        />
                        <span>
                          {paymentProviderWithConfiguration.paymentProvider.getTitle()}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y divide-border border-border border-t px-0">
                      {/* Emtpy State */}
                      {providerProducts.filter(
                        (providerProduct) =>
                          providerProduct.paymentProviderConfigurationId ===
                          paymentProviderWithConfiguration.id
                      ).length === 0 && (
                        <div className="flex h-full flex-col items-center justify-center py-6">
                          <div className="text-muted-foreground">
                            You haven&apos;t added any{' '}
                            {paymentProviderWithConfiguration.paymentProvider.getTitle()}{' '}
                            product yet.
                          </div>
                          <div className="mt-4">
                            <ProductDetailAddProductButton
                              paymentProviderConfigurationId={
                                paymentProviderWithConfiguration.id
                              }
                              productId={product.id}
                              providerId={paymentProviderWithConfiguration.paymentProvider.getId()}
                              title={paymentProviderWithConfiguration.paymentProvider.getTitle()}
                            />
                          </div>
                        </div>
                      )}

                      {providerProducts
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
                            paymentProviderId={paymentProviderWithConfiguration.paymentProvider.getId()}
                            providerProduct={providerProduct}
                          />
                        ))}
                    </CardContent>
                    {providerProducts.filter(
                      (providerProduct) =>
                        providerProduct.paymentProviderConfigurationId ===
                        paymentProviderWithConfiguration.id
                    ).length > 0 && (
                      <CardFooter className="flex items-baseline justify-between border-border border-t bg-background py-3 [.border-t]:pt-3">
                        <ProductDetailAddProductButton
                          paymentProviderConfigurationId={
                            paymentProviderWithConfiguration.id
                          }
                          productId={product.id}
                          providerId={paymentProviderWithConfiguration.paymentProvider.getId()}
                          title={paymentProviderWithConfiguration.paymentProvider.getTitle()}
                          variant="secondary"
                        />
                      </CardFooter>
                    )}
                  </Card>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
});

export const ProductDetailPage = ServerComponent.build(_ProductDetailPage);
