import { Page } from "@/features/shell";
import { CreateProductModalButton } from "./create-product-modal-button";
import { Card } from "@voidhash/ui";
import { ProductRecord } from "./product-record";
import { ProductsPageEmptyState } from "./products-page-empty-state";
import { ProductRecordConfigurationStateIndicator } from "./product-record-configuration-state-indicator";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { Effect } from "effect";
import { ProjectService } from "@/lib/services/project.service";
import { Environment } from "@/lib/effect/environment";
import { NotFoundError } from "@/lib/effect/errors";
import { ProductService } from "@/lib/services/product.service";
import { AuthSession } from "@/lib/effect/auth";

export async function ProductsPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug;
}) {
	const data = await runServerEffect(AuthSession.withAuthSession()(Environment.withEnvironment({
		organizationSlug,
		projectSlug,
	})(Effect.gen(function* () {
		const projectService = yield* ProjectService;
		const productService = yield* ProductService;
		const project = yield* projectService.getProjectBySlugAndOrganizationSlug({
			organizationSlug,
			projectSlug,
		});
		if (!project) {
			return yield* Effect.fail(new NotFoundError({
				message: "Project not found",
			}));
		}
		const products = yield* productService.getProducts(project.id);
		return { project, products };
	}))));

	if (data.isErr()) {
		const error = data._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const { project, products } = data.value;


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
