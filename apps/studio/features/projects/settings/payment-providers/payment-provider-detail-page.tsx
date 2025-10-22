'use client';

import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from 'hooks/tanstack-query';
import { useParams } from 'next/navigation';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { getPaymentProviderConfigurationOptions } from '@/lib/tanstack-query';
import { CurrentUser } from '@/lib/utils/current-user';
import { PaymentProviderDetailConfiguration } from './payment-provider-detail-configuration';

export const PaymentProviderDetailPage = () => {
  const params = useParams();
  const organizationSlug = params.organizationSlug as string;
  const projectSlug = params.projectSlug as string;
  const paymentProviderConfigurationId =
    params.paymentProviderConfigurationId as string;

  const { data: currentUser, status: currentUserStatus } = useCurrentUser();
  const project =
    currentUser &&
    CurrentUser.getProjectBySlugs(
      currentUser,
      organizationSlug as string,
      projectSlug as string
    );

  const {
    data: paymentProviderConfiguration,
    status: paymentProviderConfigurationStatus
  } = useQuery({
    ...getPaymentProviderConfigurationOptions({
      id: paymentProviderConfigurationId
    }),
    enabled: !!paymentProviderConfigurationId
  });

  if (
    currentUserStatus === 'pending' ||
    paymentProviderConfigurationStatus === 'pending'
  ) {
    return <div>Loading...</div>;
  }

  if (
    currentUserStatus === 'error' ||
    paymentProviderConfigurationStatus === 'error' ||
    !project ||
    !paymentProviderConfiguration
  ) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the payment provider configuration'
        }}
      />
    );
  }

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
};
