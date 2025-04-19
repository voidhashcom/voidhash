import { Page } from "@/features/shell";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { getPaymentProviderConfigurations } from "@/lib/services/payment-providers/queries";
import {
	getProductById,
	getProviderProductsByProductId,
} from "@/lib/services/products/queries";
import { notFound } from "next/navigation";
import { ProductDetailPaymentProvidersEmptyState } from "./product-detail-payment-providers-empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@voidhash/ui";
import { PaymentProviderLogo } from "../payment-providers/payment-provider-logo";
import { ProductDetailAddProductButton } from "./product-detail-add-product-button";
import { ProductDetailProviderProductRecord } from "./product-detail-provider-product-record";

export async function ProductDetailPage({
	organizationSlug,
	projectSlug,
	id,
}: {
	organizationSlug: string;
	projectSlug: string;
	id: string;
}) {
	const product = await getProductById({
		ctx: await createNextServiceContext(),
		input: { id },
	});

	if (!product) {
		return notFound();
	}

	const serviceContext = await createNextServiceContext();
	const providerProductsPromise = getProviderProductsByProductId({
		ctx: serviceContext,
		input: { productId: product.id },
	});

	const paymentProviderConfigurationsPromise = getPaymentProviderConfigurations(
		{
			ctx: serviceContext,
			input: { projectId: product.projectId },
		}
	);

	const [providerProducts, paymentProviderConfigurations] = await Promise.all([
		providerProductsPromise,
		paymentProviderConfigurationsPromise,
	]);

	const paymentProvidersWithEnabledConfigurations = paymentProviders
		.map((paymentProvider) => {
			const paymentProviderConfiguration = paymentProviderConfigurations.find(
				(paymentProviderConfiguration) =>
					paymentProviderConfiguration.providerId === paymentProvider.id
			);

			return {
				paymentProvider,
				enabled:
					!!paymentProviderConfiguration &&
					paymentProviderConfiguration.enabled,
				configuration: paymentProviderConfiguration,
			};
		})
		.filter((paymentProvider) => paymentProvider.enabled);

	return (
		<Page
			breadcrumbs={[
				{
					title: "Products",
					url: `/${organizationSlug}/${projectSlug}/storefront/products`,
				},
				{
					title: product.name,
					url: `/${organizationSlug}/${projectSlug}/storefront/products/${id}`,
				},
			]}
		>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">
						{product.name}
					</h1>
					{/* <CreateProductModalButton projectId={project.id} /> */}
				</div>

				<div className="mt-8">
					{paymentProvidersWithEnabledConfigurations.length === 0 && (
						<ProductDetailPaymentProvidersEmptyState
							projectSlug={projectSlug}
							organizationSlug={organizationSlug}
						/>
					)}
					{paymentProvidersWithEnabledConfigurations.map(
						(paymentProviderWithConfiguration) => (
							<Card
								className="pb-0 overflow-hidden mt-8 gap-0"
								key={paymentProviderWithConfiguration.paymentProvider.id}
							>
								<CardHeader className="pb-4">
									<CardTitle className="flex items-center gap-4">
										<PaymentProviderLogo
											providerId={
												paymentProviderWithConfiguration.paymentProvider.id
											}
											className="w-5 h-5"
										/>
										<span>
											{paymentProviderWithConfiguration.paymentProvider.title}
										</span>
									</CardTitle>
								</CardHeader>
								<CardContent className="border-t border-border divide-y divide-border px-0">
									{/* Emtpy State */}
									{providerProducts.filter(
										(providerProduct) =>
											providerProduct.providerId ===
											paymentProviderWithConfiguration.paymentProvider.id
									).length === 0 && (
										<div className="flex flex-col items-center justify-center h-full py-6">
											<div className="text-muted-foreground">
												You haven&apos;t added any{" "}
												{paymentProviderWithConfiguration.paymentProvider.title}{" "}
												product yet.
											</div>
											<div className="mt-4">
												<ProductDetailAddProductButton
													productId={product.id}
													providerId={
														paymentProviderWithConfiguration.paymentProvider.id
													}
													title={
														paymentProviderWithConfiguration.paymentProvider
															.title
													}
												/>
											</div>
										</div>
									)}

									{providerProducts
										.filter(
											(providerProduct) =>
												providerProduct.providerId ===
												paymentProviderWithConfiguration.paymentProvider.id
										)
										.map((providerProduct) => (
											<ProductDetailProviderProductRecord
												key={providerProduct.providerProductKey}
												providerProduct={providerProduct}
												paymentProviderId={
													paymentProviderWithConfiguration.paymentProvider.id
												}
											/>
										))}
								</CardContent>
							</Card>
						)
					)}
				</div>
			</div>
		</Page>
	);
}
