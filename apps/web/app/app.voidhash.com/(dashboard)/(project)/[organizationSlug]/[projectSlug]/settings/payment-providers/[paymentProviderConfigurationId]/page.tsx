import { PaymentProviderDetailPage } from "@/features/projects/settings/payment-providers/payment-provider-detail-page";

export default async function Page({
	params,
}: {
	params;
}) {
	return <PaymentProviderDetailPage paramsPromise={params} />;
}
