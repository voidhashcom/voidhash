import { Page } from "@/features/shell";
import { CreateProductModalButton } from "./create-product-modal-button";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { notFound } from "next/navigation";
import { getProducts } from "@/lib/services/products/queries";
import { Card } from "@voidhash/ui";
import { ProductRecord } from "./product-record";
import { ProductsPageEmptyState } from "./products-page-empty-state";
import { ProductRecordConfigurationStateIndicator } from "./product-record-configuration-state-indicator";

export async function ProductsPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug;
}) {
	const serviceContext = await createNextServiceContext();
	const project = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { projectSlug: projectSlug, organizationSlug },
	});

	if (!project) {
		return notFound();
	}

	const products = await getProducts({
		ctx: serviceContext,
		input: { projectId: project.id },
	});

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">Products</h1>
					<CreateProductModalButton projectId={project.id} />
				</div>
				<p className="text-muted-foreground mt-3">
					List of products available to purchase.
				</p>
				<div className="mt-8">
					{products.length === 0 ? (
						<ProductsPageEmptyState projectId={project.id} />
					) : (
						<Card className="divide-y grid p-0 gap-0">
							{products.map((product) => (
								<ProductRecord
									key={product.id}
									product={product}
									organizationSlug={organizationSlug}
									projectSlug={projectSlug}
									configurationStateIndicator={
										<ProductRecordConfigurationStateIndicator
											productId={product.id}
											projectId={project.id}
										/>
									}
								/>
							))}
						</Card>
					)}
				</div>
			</div>
		</Page>
	);
}
