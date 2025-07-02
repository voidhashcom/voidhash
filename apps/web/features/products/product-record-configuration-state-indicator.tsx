import { Badge } from "@voidhash/ui";
import { PaymentProviderLogo } from "../projects/settings/payment-providers/payment-provider-logo";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { Effect } from "effect";
import { ProductService } from "@/lib/services/products/product.service";
import { PaymentProviderService } from "@/lib/services/payment-providers/payment-provider.service";

export async function ProductRecordConfigurationStateIndicator({
	productId,
	projectId,
}: {
	productId: string;
	projectId: string;

}) {
	const data = await runServerEffect(Effect.gen(function* () {
		const productService = yield* ProductService;
		const paymentProviderService = yield* PaymentProviderService;
	
		const [providerProducts, paymentProviderConfigurations] = yield* Effect.all([
			productService.getProviderProductsByProductId(productId),
			paymentProviderService.getPaymentProviderConfigurations(projectId),
		]);
		return { providerProducts, paymentProviderConfigurations };
	}));

	if (data.isErr()) {
		return <Badge>Loading error</Badge>;
	}

	const { providerProducts, paymentProviderConfigurations } = data.value;

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
							providerProduct.paymentProviderConfigurationId ===
							paymentProviderConfiguration.id
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
