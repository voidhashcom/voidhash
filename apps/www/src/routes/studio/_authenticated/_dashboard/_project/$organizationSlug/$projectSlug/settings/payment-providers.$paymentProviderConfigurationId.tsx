import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Page, PageHeader, Skeleton } from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { PaymentProviderDetailRouter } from "@/features/studio/projects/settings/payment-providers/payment-provider-detail-router";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { getPaymentProviderConfigurationOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/payment-providers/$paymentProviderConfigurationId",
)({
  component: PaymentProviderDetailPage,
  errorComponent: PaymentProviderDetailPageError,
  pendingComponent: PaymentProviderDetailPageSkeleton,
});

function PaymentProviderDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the payment provider configuration",
      }}
    />
  );
}

function PaymentProviderDetailPageSkeleton() {
  return (
    <Page className="flex min-h-[calc(100svh-var(--header-height))] flex-col">
      <PageHeader>
        <Skeleton className="h-4 w-48" />
      </PageHeader>
      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-8 px-6 py-8">
        <div className="flex w-56 shrink-0 flex-col gap-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-9 w-full" key={`payment-provider-tab-skeleton-${index}`} />
          ))}
        </div>
        <Card className="min-w-0 flex-1 self-start p-6">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        </Card>
      </div>
    </Page>
  );
}

function PaymentProviderDetailPage() {
  const { organizationSlug, projectSlug, paymentProviderConfigurationId } = Route.useParams();

  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: paymentProviderConfiguration } = useSuspenseQuery(
    getPaymentProviderConfigurationOptions({
      id: paymentProviderConfigurationId as string,
    }),
  );

  return (
    <PaymentProviderDetailRouter
      organizationSlug={organizationSlug}
      paymentProviderConfiguration={paymentProviderConfiguration}
      project={project}
      projectSlug={projectSlug}
    />
  );
}
