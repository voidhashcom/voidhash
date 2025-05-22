import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { getPaymentProviderConfigurations } from "@/lib/services/payment-providers/queries";
import { getProviderProductsByProductId } from "@/lib/services/products/queries";
import { Badge } from "@voidhash/ui";
import { PaymentProviderLogo } from "../payment-providers/payment-provider-logo";

export async function ProductRecordConfigurationStateIndicator({
	productId,
	projectId,
}: {
	productId: string;
	projectId: string;
}) {
	const serviceContext = await createNextServiceContext();
	const providerProductsPromise = getProviderProductsByProductId({
		ctx: serviceContext,
		input: { productId: productId },
	});

	const paymentProviderConfigurationsPromise = getPaymentProviderConfigurations(
		{
			ctx: serviceContext,
			input: { projectId: projectId },
		}
	);

	const [providerProductsResult, paymentProviderConfigurationsResult] =
		await Promise.all([
			providerProductsPromise,
			paymentProviderConfigurationsPromise,
		]);

	if (
		providerProductsResult.isErr() ||
		paymentProviderConfigurationsResult.isErr()
	) {
		return <Badge>Loading error</Badge>;
	}

	const providerProducts = providerProductsResult.value;
	const paymentProviderConfigurations =
		paymentProviderConfigurationsResult.value;

	if (providerProducts.length === 0) {
		return <Badge>Configuration required</Badge>;
	}

	if (paymentProviderConfigurations.length === 0) {
		return <Badge>Configuration required</Badge>;
	}

	return (
		<div className="flex flex-row gap-3 items-center">
			{paymentProviderConfigurations
				.filter((f) => !!f.enabled)
				.map((paymentProviderConfiguration) => {
					return providerProducts.some(
						(providerProduct) =>
							providerProduct.providerId ===
							paymentProviderConfiguration.providerId
					) ? (
						<PaymentProviderLogo
							key={paymentProviderConfiguration.providerId}
							providerId={
								paymentProviderConfiguration.providerId as
									| "stripe"
									| "app-store"
							}
							className="w-4 h-4"
						/>
					) : null;
				})}
		</div>
	);
}
