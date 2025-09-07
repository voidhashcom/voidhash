import { Environment as EnvironmentEnum } from '@voidhash/lib/index';
import { Badge, Card, CardHeader, CardTitle, cn } from '@voidhash/ui';
import { Effect } from 'effect';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { Page } from '@/features/shell';
import { EnvironmentFilterNotification } from '@/features/shell/components/environment-filter-notification';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { NotFoundError } from '@/lib/effect/errors';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
// import { StripeConfigurationSheet } from "./stripe/stripe-configuration-sheet";
// import { AppStoreConfigurationSheet } from "./app-store/app-store-configuration-sheet";
import { paymentProviders } from '@/lib/payment-providers/payment-providers';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import {
  Environment,
  EnvironmentService
} from '@/lib/services/environment.service';
import { PaymentProviderService } from '@/lib/services/payment-provider.service';
import { ProjectService } from '@/lib/services/project.service';
import { PaymentProviderLogo } from './payment-provider-logo';
import { PaymentProvidersNewStoreDropdown } from './payment-providers-new-store-dropdown';
import { SetupPaymentProviderButton } from './setup-payment-provider-button';

export async function PaymentProvidersPage({
  paramsPromise
}: {
  paramsPromise: Promise<{
    organizationSlug: string;
    projectSlug: string;
  }>;
}) {
  const { organizationSlug, projectSlug } = await paramsPromise;

  const data = await runServerEffect(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const environmentService = yield* EnvironmentService;
          const environment =
            yield* environmentService.getEnvironmentFromCookie({
              organizationSlug,
              projectSlug
            });
          return yield* Environment.provide(environment)(
            Effect.gen(function* () {
              const projectService = yield* ProjectService;
              const paymentProviderService = yield* PaymentProviderService;
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
              const paymentProviderConfigurations =
                yield* paymentProviderService.getPaymentProviderConfigurations(
                  project.id
                );

              return { project, environment, paymentProviderConfigurations };
            })
          );
        })
      );
    })
  );

  if (data.isErr()) {
    const error = data._unsafeUnwrapErr();
    return <VoidhashErrorCard error={error} />;
  }

  const { project, environment, paymentProviderConfigurations } = data.value;

  const applicationsWithConfiguration = paymentProviderConfigurations
    .map((p) => {
      const paymentProvider = paymentProviders.find(
        (pp) => pp.getId() === p.providerId
      );
      if (!paymentProvider || paymentProvider.getType() !== 'native') {
        return null;
      }
      return {
        ...p,
        provider: paymentProvider
      };
    })
    .filter(Boolean);

  const webCheckoutProvidersWithConfigurations = paymentProviders
    .filter((p) => p.getType() === 'web-checkout' && p.getIsConfigurable())
    .map((paymentProvider) => {
      const paymentProvidersConfiguration = paymentProviderConfigurations?.find(
        (p) => p.providerId === paymentProvider.getId()
      );
      return {
        ...paymentProvidersConfiguration,
        provider: paymentProvider
      };
    });

  return (
    <Page>
      {/* Key is used to reload the default form data when the organization slug changes */}
      <div className="mx-auto max-w-4xl">
        <h1 className="font-normal text-3xl tracking-right">
          Payment Providers
        </h1>
        <p className="mt-3 text-muted-foreground">
          Configure your payment providers.
        </p>

        {environment === EnvironmentEnum.Testing && (
          <EnvironmentFilterNotification
            className="mt-6"
            message="Payment providers configured here are shared between development and production environments. Please proceed with caution."
            type="testing"
          />
        )}

        <div className="mt-8">
          <Card className={cn('grid gap-0 divide-y p-0')}>
            <CardHeader
              className={cn(
                'gap-0 pr-3',
                applicationsWithConfiguration.length > 0 ? 'py-3' : 'py-6'
              )}
            >
              <div className="flex items-center justify-between">
                <CardTitle>Stores</CardTitle>
                {applicationsWithConfiguration.length > 0 && (
                  <PaymentProvidersNewStoreDropdown
                    organizationSlug={organizationSlug}
                    project={project}
                    projectSlug={projectSlug}
                  />
                )}
              </div>
            </CardHeader>
            {applicationsWithConfiguration.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center py-6">
                <div className="text-muted-foreground">
                  You haven&apos;t configured any stores for this project.
                </div>
                <div className="mt-4">
                  <PaymentProvidersNewStoreDropdown
                    organizationSlug={organizationSlug}
                    project={project}
                    projectSlug={projectSlug}
                  />
                </div>
              </div>
            )}

            {applicationsWithConfiguration?.map(
              (paymentProviderConfiguration) =>
                paymentProviderConfiguration?.provider ? (
                  <div
                    className="group relative isolate px-6 py-4 hover:bg-accent/30"
                    key={paymentProviderConfiguration.id}
                  >
                    {/* <PaymentProviderConfigurationSheet
											providerId={paymentProviderConfiguration.provider.getId()}
											enabled={paymentProviderConfiguration.enabled ?? false}
											configuration={paymentProviderConfiguration.configuration}
											project={project}
											name={
												paymentProviderConfiguration.name ??
												paymentProviderConfiguration.provider.getTitle()
											}
											id={paymentProviderConfiguration.id}
											trigger={
												<Link
													className="inset-0 absolute w-full h-full"
													href={`/${organizationSlug}/${projectSlug}/settings/payment-providers`}
												></Link>
											}
										/> */}

                    <Link
                      className="absolute inset-0 h-full w-full"
                      href={`/${organizationSlug}/${projectSlug}/settings/payment-providers/${paymentProviderConfiguration.id}`}
                    />

                    <div className="flex flex-row items-center justify-between">
                      <div className="flex flex-1 items-center gap-4">
                        <div className="flex h-8 w-8 items-center justify-center">
                          <PaymentProviderLogo
                            className="h-full w-full"
                            providerId={paymentProviderConfiguration.provider.getId()}
                          />
                        </div>
                        <div className="flex flex-col">
                          <p>{paymentProviderConfiguration.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {paymentProviderConfiguration.enabled && (
                          <Badge>Enabled</Badge>
                        )}
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ) : null
            )}
          </Card>
        </div>

        <div className="mt-8">
          <Card className={cn('grid gap-0 divide-y p-0')}>
            <CardHeader className="gap-0 py-6 pr-3">
              <div className="flex items-center justify-between">
                <CardTitle>Web Checkout Providers</CardTitle>
              </div>
            </CardHeader>
            {webCheckoutProvidersWithConfigurations?.map(
              (paymentProviderConfiguration) => (
                <div
                  className="group relative isolate px-6 py-4 hover:bg-accent/30"
                  key={
                    paymentProviderConfiguration.id ??
                    paymentProviderConfiguration.provider.getId()
                  }
                >
                  {paymentProviderConfiguration.id &&
                    paymentProviderConfiguration.provider.getIsConfigurable() && (
                      <Link
                        className="absolute inset-0 h-full w-full"
                        href={`/${organizationSlug}/${projectSlug}/settings/payment-providers/${paymentProviderConfiguration.id}`}
                      />
                    )}

                  <div className="flex flex-row items-center justify-between">
                    <div className="flex flex-1 items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center">
                        <PaymentProviderLogo
                          className="h-full w-full"
                          providerId={paymentProviderConfiguration.provider.getId()}
                        />
                      </div>
                      <div className="flex flex-col">
                        <p>
                          {paymentProviderConfiguration.provider.getTitle()}
                        </p>
                      </div>
                    </div>

                    {/* If configuration exists, show the enabled/disabled badge and the chevron right */}
                    {paymentProviderConfiguration.id && (
                      <div className="flex items-center gap-2">
                        {paymentProviderConfiguration.enabled ? (
                          <Badge>Enabled</Badge>
                        ) : (
                          <Badge variant="outline">Disabled</Badge>
                        )}
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}

                    {/* If configuration does not exist, show the add button */}
                    {!paymentProviderConfiguration.id && (
                      <div className="flex items-center gap-2">
                        <SetupPaymentProviderButton
                          organizationSlug={organizationSlug}
                          projectId={project.id}
                          projectSlug={projectSlug}
                          providerId={paymentProviderConfiguration.provider.getId()}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}
