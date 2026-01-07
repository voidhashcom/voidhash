import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from 'src/components/auth-context';
import { PaymentProviderDetailConfiguration } from '@/features/projects/settings/payment-providers/payment-provider-detail-configuration';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { getPaymentProviderConfigurationOptions } from '@/lib/tanstack-query';
import { CurrentUser } from '@/lib/utils/current-user';

export const Route = createFileRoute(
  '/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/payment-providers/$paymentProviderConfigurationId'
)({
  pendingComponent: PaymentProviderDetailPageSkeleton,
  errorComponent: PaymentProviderDetailPageError,
  component: PaymentProviderDetailPage
});

function PaymentProviderDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred loading the payment provider configuration'
      }}
    />
  );
}

function PaymentProviderDetailPageSkeleton() {
  return <div>Loading...</div>;
}

function PaymentProviderDetailPage() {
  const { organizationSlug, projectSlug, paymentProviderConfigurationId } =
    Route.useParams();

  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string
  );

  if (!project) {
    throw new Error('Project not found');
  }

  const { data: paymentProviderConfiguration } = useSuspenseQuery(
    getPaymentProviderConfigurationOptions({
      id: paymentProviderConfigurationId as string
    })
  );

  return (
    <Page
      breadcrumbs={[
        {
          title: 'Payment Providers',
          url: `/${organizationSlug}/${projectSlug}/settings/payment-providers`
        },
        {
          title: paymentProviderConfiguration.name,
          url: `/${organizationSlug}/${projectSlug}/settings/payment-providers/${paymentProviderConfiguration.id}`
        }
      ]}
      className="flex flex-1 flex-col p-0 pt-3 pb-0"
    >
      <PaymentProviderDetailConfiguration
        organizationSlug={organizationSlug}
        paymentProviderConfiguration={paymentProviderConfiguration}
        project={project}
        projectSlug={projectSlug}
      />
    </Page>
  );
}
