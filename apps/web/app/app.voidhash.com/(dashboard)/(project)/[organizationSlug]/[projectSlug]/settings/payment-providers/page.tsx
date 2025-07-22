import { PaymentProvidersPage } from '@/features/projects/settings/payment-providers/payment-providers-page';

export default function Page({ params }: { params }) {
  return <PaymentProvidersPage paramsPromise={params} />;
}
