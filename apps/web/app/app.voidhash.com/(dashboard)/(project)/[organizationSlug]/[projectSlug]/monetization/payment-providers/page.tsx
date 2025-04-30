import { PaymentProvidersPage } from "@/features/monetization/payment-providers/payment-providers-page";

export default async function Page({
	params,
}: {
	params;
}) {
	return <PaymentProvidersPage paramsPromise={params} />;
}
