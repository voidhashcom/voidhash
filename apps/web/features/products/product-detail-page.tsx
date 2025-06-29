import { Page } from "@/features/shell";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { getPaymentProviderConfigurations } from "@/lib/services/payment-providers/queries";
import {
	getProductById,
	getProductPerksByProductId,
	getProviderProductsByProductId,
} from "@/lib/services/products/queries";
import { ProductDetailPaymentProvidersEmptyState } from "./product-detail-payment-providers-empty-state";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@voidhash/ui";
import { PaymentProviderLogo } from "../projects/settings/payment-providers/payment-provider-logo";
import { ProductDetailAddProductButton } from "./product-detail-add-product-button";
import { ProductDetailProviderProductRecord } from "./product-detail-provider-product-record";
import { ProductDetailPerksEmptyState } from "./product-detail-perks-empty-state";
import { ProductDetailPerkRecord } from "./product-detail-product-perk-record";
import { ProductDetailAddPerkButton } from "./product-detail-add-perk-button";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { getEnvironment } from "@/lib/services/environments/utils";
import { NextjsRuntime } from "@/lib/effect/runtimes/nextjs";
import { PerkService } from "@/lib/services/perks/perk.service";
import { Effect, pipe } from "effect";
import { tryCatch } from "@/lib/try-catch";

export async function ProductDetailPage({
	organizationSlug,
	projectSlug,
	id,
}: {
	organizationSlug: string;
	projectSlug: string;
	id: string;
}) {
	const productResult = await getProductById({
		ctx: await createNextServiceContext(),
		input: { id },
	});

	if (productResult.isErr()) {
		const error = productResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const product = productResult.value;

	const serviceContext = await createNextServiceContext();
	const providerProductsPromise = getProviderProductsByProductId({
		ctx: serviceContext,
		input: { productId: product.id },
	});

	const environmentPromise = getEnvironment(
		serviceContext.cookies,
		organizationSlug,
		projectSlug
	);

	const paymentProviderConfigurationsPromise = getPaymentProviderConfigurations(
		{
			ctx: serviceContext,
			input: { projectId: product.projectId },
		}
	);

	const perksPromise = tryCatch(
		NextjsRuntime.runPromise(
			pipe(
				PerkService,
				Effect.flatMap((perkService) => perkService.getPerks(product.projectId))
			)
		)
	);

	const productPerksPromise = getProductPerksByProductId({
		ctx: serviceContext,
		input: { productId: product.id },
	});

	const [
		providerProductsResult,
		paymentProviderConfigurationsResult,
		perksResult,
		productPerksResult,
		environmentResult,
	] = await Promise.all([
		providerProductsPromise,
		paymentProviderConfigurationsPromise,
		perksPromise,
		productPerksPromise,
		environmentPromise,
	]);

	if (providerProductsResult.isErr()) {
		const error = providerProductsResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const providerProducts = providerProductsResult.value;

	if (paymentProviderConfigurationsResult.isErr()) {
		const error = paymentProviderConfigurationsResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const paymentProviderConfigurations =
		paymentProviderConfigurationsResult.value;

	if (perksResult.error) {
		return <VoidhashErrorCard error={perksResult.error} />;
	}

	const perks = perksResult.data;

	if (productPerksResult.isErr()) {
		const error = productPerksResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const productPerks = productPerksResult.value;

	if (environmentResult.isErr()) {
		const error = environmentResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const environment = environmentResult.value;

	const enabledPaymentProviderConfigurations = paymentProviderConfigurations
		.map((paymentProviderConfiguration) => {
			const paymentProvider = paymentProviders.find(
				(paymentProvider) =>
					paymentProvider.getId() === paymentProviderConfiguration.providerId
			);

			if (!paymentProvider) {
				return null;
			}

			return {
				paymentProvider,
				id: paymentProviderConfiguration.id,
				name: paymentProviderConfiguration.name,
				enabled:
					!!paymentProviderConfiguration &&
					paymentProviderConfiguration.enabled,
				configuration: paymentProviderConfiguration,
			};
		})
		.filter(
			(paymentProviderConfiguration) => paymentProviderConfiguration !== null
		)
		.filter(
			(paymentProviderConfiguration) =>
				paymentProviderConfiguration.paymentProvider.getIsProductConfigurable() &&
				paymentProviderConfiguration.enabled
		);

	const perksWithoutProductPerks = perks.filter(
		(perk) =>
			!productPerks.some((productPerk) => productPerk.perkId === perk.id)
	);

	return (
		<Page
			className="p-0 py-8"
			breadcrumbs={[
				{
					title: "Products",
					url: `/${organizationSlug}/${projectSlug}/products`,
				},
				{
					title: product.name,
					url: `/${organizationSlug}/${projectSlug}/products/${id}`,
				},
			]}
		>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="border-b border-border">
				<div className="max-w-4xl mx-auto  pb-10">
					<div className="flex flex-row items-center justify-between">
						<h1 className="text-3xl font-normal tracking-right">
							{product.name}
						</h1>
						{/* <CreateProductModalButton projectId={project.id} /> */}
					</div>
				</div>
			</div>
			<div className="max-w-4xl mx-auto">
				<div className="mt-8">
					<h2 className="text-2xl font-normal tracking-right">Perks</h2>
					<p className="text-muted-foreground mt-2">
						Configure what perks this product unlocks.
					</p>

					<div className="mt-8">
						{productPerks.length === 0 && (
							<ProductDetailPerksEmptyState
								productId={product.id}
								perks={perksWithoutProductPerks}
							/>
						)}
						{productPerks.length > 0 && (
							<Card className="pb-0 overflow-hidden mt-8 gap-0 pt-0">
								<CardContent className="divide-y divide-border px-0">
									{productPerks.map((productPerk) => (
										<ProductDetailPerkRecord
											key={productPerk.perkId}
											productPerk={productPerk}
											perks={perks}
										/>
									))}
								</CardContent>

								<CardFooter className="bg-background py-3 border-t border-border [.border-t]:pt-3 flex items-baseline justify-between">
									<ProductDetailAddPerkButton
										productId={product.id}
										perks={perksWithoutProductPerks}
										variant="secondary"
									/>
								</CardFooter>
							</Card>
						)}
					</div>
				</div>
				{environment !== "testing" && (
					<div className="mt-16">
						<h2 className="text-2xl font-normal tracking-right">
							Payment Providers
						</h2>
						<p className="text-muted-foreground mt-2">
							Sets up a relationship between this voidhash product and payment
							providers products.
						</p>

						<div className="mt-8">
							{enabledPaymentProviderConfigurations.length === 0 && (
								<ProductDetailPaymentProvidersEmptyState
									projectSlug={projectSlug}
									organizationSlug={organizationSlug}
								/>
							)}
							{enabledPaymentProviderConfigurations.map(
								(paymentProviderWithConfiguration) => (
									<Card
										className="pb-0 overflow-hidden mt-8 gap-0"
										key={paymentProviderWithConfiguration.paymentProvider.getId()}
									>
										<CardHeader className="pb-4">
											<CardTitle className="flex items-center gap-4">
												<PaymentProviderLogo
													providerId={paymentProviderWithConfiguration.paymentProvider.getId()}
													className="w-5 h-5"
												/>
												<span>
													{paymentProviderWithConfiguration.paymentProvider.getTitle()}
												</span>
											</CardTitle>
										</CardHeader>
										<CardContent className="border-t border-border divide-y divide-border px-0">
											{/* Emtpy State */}
											{providerProducts.filter(
												(providerProduct) =>
													providerProduct.paymentProviderConfigurationId ===
													paymentProviderWithConfiguration.id
											).length === 0 && (
												<div className="flex flex-col items-center justify-center h-full py-6">
													<div className="text-muted-foreground">
														You haven&apos;t added any{" "}
														{paymentProviderWithConfiguration.paymentProvider.getTitle()}{" "}
														product yet.
													</div>
													<div className="mt-4">
														<ProductDetailAddProductButton
															productId={product.id}
															paymentProviderConfigurationId={
																paymentProviderWithConfiguration.id
															}
															providerId={paymentProviderWithConfiguration.paymentProvider.getId()}
															title={paymentProviderWithConfiguration.paymentProvider.getTitle()}
														/>
													</div>
												</div>
											)}

											{providerProducts
												.filter(
													(providerProduct) =>
														providerProduct.paymentProviderConfigurationId ===
														paymentProviderWithConfiguration.id
												)
												.map((providerProduct) => (
													<ProductDetailProviderProductRecord
														key={providerProduct.providerProductKey}
														paymentProviderConfigurationId={
															paymentProviderWithConfiguration.id
														}
														providerProduct={providerProduct}
														paymentProviderId={paymentProviderWithConfiguration.paymentProvider.getId()}
													/>
												))}
										</CardContent>
										{providerProducts.filter(
											(providerProduct) =>
												providerProduct.paymentProviderConfigurationId ===
												paymentProviderWithConfiguration.id
										).length > 0 && (
											<CardFooter className="bg-background py-3 border-t border-border [.border-t]:pt-3 flex items-baseline justify-between">
												<ProductDetailAddProductButton
													variant="secondary"
													productId={product.id}
													paymentProviderConfigurationId={
														paymentProviderWithConfiguration.id
													}
													providerId={paymentProviderWithConfiguration.paymentProvider.getId()}
													title={paymentProviderWithConfiguration.paymentProvider.getTitle()}
												/>
											</CardFooter>
										)}
									</Card>
								)
							)}
						</div>
					</div>
				)}
			</div>
		</Page>
	);
}
