import { Page } from "@/features/shell";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { notFound } from "next/navigation";
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
	const project = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { organizationSlug: organizationSlug, projectSlug: projectSlug },
	});
	if (!project) {
		return notFound();
	}
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

	const [paywall, paywallProducts, products] = await Promise.all([
		paywallPromise,
		paywallProductsPromise,
		productsPromise,
	]);

	if (!paywall) {
		return notFound();
	}

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
