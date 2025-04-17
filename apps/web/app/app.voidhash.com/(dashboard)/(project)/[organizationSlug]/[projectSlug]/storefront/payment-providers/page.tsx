import { PaymentProvidersPage } from "@/features/storefront/payment-providers/payment-providers-page";

export default async function Page({
	params,
}: {
	params;
}) {
	return <PaymentProvidersPage paramsPromise={params} />;
}
