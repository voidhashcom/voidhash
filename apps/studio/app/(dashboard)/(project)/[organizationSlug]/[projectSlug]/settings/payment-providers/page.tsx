import { PaymentProvidersPage } from '@/features/projects/settings/payment-providers/payment-providers-page';

export default function PaymentProvidersPageExposed({
  params
}: {
  params: {
    organizationSlug: string;
    projectSlug: string;
  };
}) {
  return <PaymentProvidersPage params={params} />;
}
