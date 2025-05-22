import { Page } from "@/features/shell";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import {
	getPaywallById,
	getPaywallProducts,
} from "@/lib/services/paywalls/queries";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@voidhash/ui";
import { PaywallDetailProductRecord } from "./paywall-detail-product-record";
import { getProducts } from "@/lib/services/products/queries";
import { PaywallDetailAddProductButton } from "./paywall-detail-add-product-button";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";

export async function PaywallsDetailPage({
	organizationSlug,
	projectSlug,
	id,
}: {
	organizationSlug: string;
	projectSlug: string;
	id: string;
}) {
	const serviceContext = await createNextServiceContext();
	const projectResult = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { organizationSlug: organizationSlug, projectSlug: projectSlug },
	});
	if (projectResult.isErr()) {
		const error = projectResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const project = projectResult.value;

	const paywallPromise = getPaywallById({
		ctx: serviceContext,
		input: { id },
	});
	const paywallProductsPromise = getPaywallProducts({
		ctx: serviceContext,
		input: { paywallId: id },
	});
	const productsPromise = getProducts({
		ctx: serviceContext,
		input: { projectId: project.id },
	});

	const [paywallResult, paywallProductsResult, productsResult] =
		await Promise.all([
			paywallPromise,
			paywallProductsPromise,
			productsPromise,
		]);

	if (paywallResult.isErr()) {
		const error = paywallResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	if (paywallProductsResult.isErr()) {
		const error = paywallProductsResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	if (productsResult.isErr()) {
		const error = productsResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const paywall = paywallResult.value;
	const paywallProducts = paywallProductsResult.value;
	const products = productsResult.value;

	const productsWithoutAddedProducts = products.filter(
		(product) =>
			!paywallProducts.some(
				(paywallProduct) => paywallProduct.productId === product.id
			)
	);

	return (
		<Page
			breadcrumbs={[
				{
					title: "Paywalls",
					url: `/${organizationSlug}/${projectSlug}/monetization/paywalls`,
				},
				{
					title: paywall.name,
					url: `/${organizationSlug}/${projectSlug}/monetization/paywalls/${id}`,
				},
			]}
		>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">
						{paywall.name}
					</h1>
					{/* <CreateProductModalButton projectId={project.id} /> */}
				</div>

				<div className="mt-8">
					<Card className="pb-0 overflow-hidden mt-8 gap-0">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-4">
								Products
							</CardTitle>
						</CardHeader>
						<CardContent className="border-t border-border divide-y divide-border px-0">
							{/* Emtpy State */}
							{paywallProducts.length === 0 && (
								<div className="flex flex-col items-center justify-center h-full py-6">
									<div className="text-muted-foreground">
										This paywall does not have any products added yet.
									</div>
									{/* <div className="mt-4">
										<ProductDetailAddProductButton
											productId={product.id}
											providerId={
												paymentProviderWithConfiguration.paymentProvider.id
											}
											title={
												paymentProviderWithConfiguration.paymentProvider.title
											}
										/>
									</div> */}
								</div>
							)}

							{paywallProducts.map((paywallProduct) => (
								<PaywallDetailProductRecord
									key={paywallProduct.productId}
									paywallProduct={paywallProduct}
								/>
							))}
						</CardContent>

						<CardFooter className="bg-background py-3 border-t border-border [.border-t]:pt-3 flex items-baseline justify-between">
							<PaywallDetailAddProductButton
								products={productsWithoutAddedProducts}
								paywallId={paywall.id}
								variant="secondary"
							/>
						</CardFooter>
					</Card>
				</div>
			</div>
		</Page>
	);
}
