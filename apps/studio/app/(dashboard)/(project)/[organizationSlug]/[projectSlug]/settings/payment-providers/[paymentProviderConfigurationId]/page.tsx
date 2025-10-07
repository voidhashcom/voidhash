export default function PaymentProviderDetailPageExposed({
  params
}: {
  params: {
    paymentProviderConfigurationId: string;
    organizationSlug: string;
    projectSlug: string;
  };
}) {
  return <PaymentProviderDetailPageExposed params={params} />;
}
