"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge, Card, CardHeader, CardTitle, cn } from "@voidhash/ui";
import { ChevronRightIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useAuth } from "src/components/auth-context";
import { Page } from "src/features/shell";
import { VoidhashErrorCard } from "src/features/shell/components/voidhash-error-card";
import { paymentProviders } from "src/lib/payment-providers/payment-providers";
import { listPaymentProviderConfigurationsOptions } from "src/lib/tanstack-query";
import { CurrentUser } from "src/lib/utils/current-user";

import { PaymentProviderLogo } from "./payment-provider-logo";
import { PaymentProvidersNewStoreDropdown } from "./payment-providers-new-store-dropdown";
import { SetupPaymentProviderButton } from "./setup-payment-provider-button";

export const PaymentProvidersPage = () => {
  const params = useParams();
  const organizationSlug = params.organizationSlug as string;
  const projectSlug = params.projectSlug as string;

  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string
  );

  const {
    data: paymentProviderConfigurations,
    status: paymentProviderConfigurationsStatus,
  } = useQuery({
    ...listPaymentProviderConfigurationsOptions({
      projectId: project?.id ?? "",
    }),
    enabled: !!project?.id,
  });

  if (paymentProviderConfigurationsStatus === "pending") {
    return <div>Loading...</div>;
  }

  if (paymentProviderConfigurationsStatus === "error" || !project) {
    return (
      <VoidhashErrorCard
        error={{
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occured loading the payment providers",
        }}
      />
    );
  }

  const applicationsWithConfiguration = (paymentProviderConfigurations ?? [])
    .map((p) => {
      const paymentProvider = paymentProviders.find(
        (pp) => pp.id === p.providerId
      );
      if (!paymentProvider || paymentProvider.type !== "native") {
        return null;
      }
      return {
        ...p,
        provider: paymentProvider,
      };
    })
    .filter(Boolean);

  const webCheckoutProvidersWithConfigurations = paymentProviders
    .filter((p) => p.type === "web-checkout")
    .map((paymentProvider) => {
      const paymentProvidersConfiguration = paymentProviderConfigurations?.find(
        (p) => p.providerId === paymentProvider.id
      );
      return {
        ...paymentProvidersConfiguration,
        provider: paymentProvider,
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

        <div className="mt-8">
          <Card className={cn("grid gap-0 divide-y p-0")}>
            <CardHeader
              className={cn(
                "gap-0 pr-3",
                applicationsWithConfiguration.length > 0 ? "py-3" : "py-6"
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
                    <Link
                      className="absolute inset-0 h-full w-full"
                      params={{
                        organizationSlug,
                        paymentProviderConfigurationId:
                          paymentProviderConfiguration.id,
                        projectSlug,
                      }}
                      to="/$organizationSlug/$projectSlug/settings/payment-providers/$paymentProviderConfigurationId"
                    />

                    <div className="flex flex-row items-center justify-between">
                      <div className="flex flex-1 items-center gap-4">
                        <div className="flex h-8 w-8 items-center justify-center">
                          <PaymentProviderLogo
                            className="h-full w-full"
                            providerId={
                              paymentProviderConfiguration.provider.id
                            }
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
          <Card className={cn("grid gap-0 divide-y p-0")}>
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
                    paymentProviderConfiguration.provider.id
                  }
                >
                  {paymentProviderConfiguration.id && (
                    <Link
                      className="absolute inset-0 h-full w-full"
                      params={{
                        organizationSlug,
                        paymentProviderConfigurationId:
                          paymentProviderConfiguration.id,
                        projectSlug,
                      }}
                      to="/$organizationSlug/$projectSlug/settings/payment-providers/$paymentProviderConfigurationId"
                    />
                  )}

                  <div className="flex flex-row items-center justify-between">
                    <div className="flex flex-1 items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center">
                        <PaymentProviderLogo
                          className="h-full w-full"
                          providerId={paymentProviderConfiguration.provider.id}
                        />
                      </div>
                      <div className="flex flex-col">
                        <p>{paymentProviderConfiguration.provider.title}</p>
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
                          providerId={paymentProviderConfiguration.provider.id}
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
};
