import { Effect } from "effect";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Badge } from "@voidhash/ui";
import { ChevronRightIcon } from "lucide-react";
import { useAuth } from "@/features/studio/components/auth-context";

import { PaymentProviderLogo } from "@/features/studio/projects/settings/payment-providers/payment-provider-logo";
import { PaymentProvidersPageSkeleton } from "@/features/studio/projects/settings/payment-providers/payment-providers-page-skeleton";
import { SetupPaymentProviderButton } from "@/features/studio/projects/settings/payment-providers/setup-payment-provider-button";
import { SettingsCard, SettingsPage, SettingsSection } from "@/features/studio/settings";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { paymentProviders } from "@/features/studio/lib/payment-providers/payment-providers";
import { listPaymentProviderConfigurationsOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/payment-providers/",
)({
  component: PaymentProvidersIndexPage,
  errorComponent: PaymentProvidersIndexPageError,
  pendingComponent: PaymentProvidersIndexPageSkeleton,
});

function PaymentProvidersIndexPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the payment providers",
      }}
    />
  );
}

function PaymentProvidersIndexPageSkeleton() {
  return <PaymentProvidersPageSkeleton />;
}

function PaymentProvidersIndexPage() {
  const { organizationSlug, projectSlug } = Route.useParams();

  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    return Effect.runSync(Effect.die(new Error("Project not found")));
  }

  const { data: paymentProviderConfigurations } = useSuspenseQuery(
    listPaymentProviderConfigurationsOptions({
      projectId: project.id,
    }),
  );

  const storeProvidersWithConfigurations = paymentProviders
    .filter((p) => p.type === "native")
    .map((paymentProvider) => {
      const paymentProvidersConfiguration = paymentProviderConfigurations?.find(
        (p) => p.providerId === paymentProvider.id,
      );
      return {
        ...paymentProvidersConfiguration,
        provider: paymentProvider,
      };
    });

  const paymentProvidersWithConfigurations = paymentProviders
    .filter((p) => p.type === "web-checkout")
    .map((paymentProvider) => {
      const paymentProvidersConfiguration = paymentProviderConfigurations?.find(
        (p) => p.providerId === paymentProvider.id,
      );
      return {
        ...paymentProvidersConfiguration,
        provider: paymentProvider,
      };
    });

  return (
    <SettingsPage title="Payment Providers">
      <SettingsSection title="Stores">
        <SettingsCard>
          {storeProvidersWithConfigurations?.map((paymentProviderConfiguration) => (
            <div
              className="group relative isolate border-border/60 border-t px-5 py-3.5 transition-colors first:border-t-0 hover:bg-muted/40"
              key={paymentProviderConfiguration.id ?? paymentProviderConfiguration.provider.id}
            >
              {paymentProviderConfiguration.id ? (
                <Link
                  className="absolute inset-0 h-full w-full"
                  params={{
                    organizationSlug,
                    paymentProviderConfigurationId: paymentProviderConfiguration.id,
                    projectSlug,
                  }}
                  to="/studio/$organizationSlug/$projectSlug/settings/payment-providers/$paymentProviderConfigurationId"
                />
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60 ring-1 ring-border/60">
                    <PaymentProviderLogo
                      className="h-5 w-5"
                      providerId={paymentProviderConfiguration.provider.id}
                    />
                  </div>
                  <p className="truncate font-medium text-foreground text-sm">
                    {paymentProviderConfiguration.provider.title}
                  </p>
                </div>

                {paymentProviderConfiguration.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {paymentProviderConfiguration.enabled ? (
                      <Badge className="text-[11px]">Enabled</Badge>
                    ) : (
                      <Badge className="text-[11px]" variant="outline">
                        Disabled
                      </Badge>
                    )}
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="relative z-10 flex shrink-0 items-center gap-2">
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
          ))}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Payment providers">
        <SettingsCard>
          {paymentProvidersWithConfigurations?.map((paymentProviderConfiguration) => (
            <div
              className="group relative isolate border-border/60 border-t px-5 py-3.5 transition-colors first:border-t-0 hover:bg-muted/40"
              key={paymentProviderConfiguration.id ?? paymentProviderConfiguration.provider.id}
            >
              {paymentProviderConfiguration.id ? (
                <Link
                  className="absolute inset-0 h-full w-full"
                  params={{
                    organizationSlug,
                    paymentProviderConfigurationId: paymentProviderConfiguration.id,
                    projectSlug,
                  }}
                  to="/studio/$organizationSlug/$projectSlug/settings/payment-providers/$paymentProviderConfigurationId"
                />
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60 ring-1 ring-border/60">
                    <PaymentProviderLogo
                      className="h-5 w-5"
                      providerId={paymentProviderConfiguration.provider.id}
                    />
                  </div>
                  <p className="truncate font-medium text-foreground text-sm">
                    {paymentProviderConfiguration.provider.title}
                  </p>
                </div>

                {paymentProviderConfiguration.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {paymentProviderConfiguration.enabled ? (
                      <Badge className="text-[11px]">Enabled</Badge>
                    ) : (
                      <Badge className="text-[11px]" variant="outline">
                        Disabled
                      </Badge>
                    )}
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="relative z-10 flex shrink-0 items-center gap-2">
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
          ))}
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}
