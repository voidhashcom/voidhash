import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from 'src/components/auth-context';
import { getOrganizationBillingOptions } from 'src/lib/tanstack-query';
import { BillingSettingsLayout } from '@/features/organizations/settings/billing/billing-settings-layout';
import { SubscriptionCard } from '@/features/organizations/settings/billing/subscription-card';
import { UsageDashboard } from '@/features/organizations/settings/billing/usage-dashboard';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';

export const Route = createFileRoute(
  '/_authenticated/_dashboard/_organization/$organizationSlug/~/settings/billing'
)({
  component: SettingsBillingPage
});

export function SettingsBillingPage() {
  const { organizationSlug } = Route.useParams();
  const { user } = useAuth();

  const activeOrganization = user.organizations.find(
    (organization) => organization.slug === organizationSlug
  );

  const { data: billingInfo, isLoading } = useQuery({
    ...getOrganizationBillingOptions({
      organizationId: activeOrganization?.id ?? ''
    }),
    enabled: !!activeOrganization?.id
  });

  if (!activeOrganization) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'NOT_FOUND',
          message: 'Organization not found'
        }}
      />
    );
  }

  return (
    <BillingSettingsLayout>
      <SubscriptionCard
        billingInfo={billingInfo}
        isLoading={isLoading}
        organizationId={activeOrganization.id}
      />
      <UsageDashboard
        isLoading={isLoading}
        usageSummaries={billingInfo?.usageSummaries}
      />
    </BillingSettingsLayout>
  );
}
