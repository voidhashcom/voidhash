import { Page } from "@/features/shell";
import { CreateProductModalButton } from "./create-product-modal-button";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { getProducts } from "@/lib/services/products/queries";
import { Card } from "@voidhash/ui";
import { ProductRecord } from "./product-record";
import { ProductsPageEmptyState } from "./products-page-empty-state";
import { ProductRecordConfigurationStateIndicator } from "./product-record-configuration-state-indicator";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { getEnvironment } from "@/lib/services/environments/utils";

export async function ProductsPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug;
}) {
	const serviceContext = await createNextServiceContext();
	const projectPromise = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { projectSlug: projectSlug, organizationSlug },
	});

	const environmentPromise = getEnvironment(
		serviceContext.cookies,
		organizationSlug,
		projectSlug
	);

	const [projectResult, environmentResult] = await Promise.all([
		projectPromise,
		environmentPromise,
	]);

	if (projectResult.isErr() || environmentResult.isErr()) {
		const error = projectResult.isErr()
			? projectResult._unsafeUnwrapErr()
			: environmentResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const project = projectResult.value;
	const environment = environmentResult.value;

	const productsResult = await getProducts({
		ctx: serviceContext,
		input: { projectId: project.id },
	});

	if (productsResult.isErr()) {
		const error = productsResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const products = productsResult.value;
	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">Products</h1>
					{products.length > 0 && (
						<CreateProductModalButton projectId={project.id} />
					)}
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
											environment={environment}
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
