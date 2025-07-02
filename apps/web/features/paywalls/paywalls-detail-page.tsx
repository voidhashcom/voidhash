import { Page } from "@/features/shell";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { PaywallDetailPageEditor } from "./paywall-detail-page-editor";
import { Effect } from "effect";
import { NotFoundError } from "@/lib/effect/errors";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { PaywallService } from "@/lib/services/paywalls/paywall.service";
import { ProductService } from "@/lib/services/products/product.service";
import { ProjectService } from "@/lib/services/projects/project.service";

export async function PaywallsDetailPage({
	organizationSlug,
	projectSlug,
	id,
}: {
	organizationSlug: string;
	projectSlug: string;
	id: string;
}) {
	
	const data = await runServerEffect(Effect.gen(function* () {
		const projectService = yield* ProjectService;
		const paywallService = yield* PaywallService;
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
		const paywall = yield* paywallService.getPaywallById(id);
		if (!paywall) {
			return yield* Effect.fail(new NotFoundError({
				message: "Paywall not found",
			}));
		}
		const paywallProducts = yield* paywallService.getPaywallProducts(id);
		const products = yield* productService.getProducts(project.id);
		return { project, paywall, paywallProducts, products };
	}));

	if (data.isErr()) {
		const error = data._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const {  paywall, paywallProducts, products } = data.value;


	return (
		<Page
			breadcrumbs={[
				{
					title: "Paywalls",
					url: `/${organizationSlug}/${projectSlug}/paywalls`,
				},
				{
					title: paywall.name,
					url: `/${organizationSlug}/${projectSlug}/paywalls/${id}`,
				},
			]}
		>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<PaywallDetailPageEditor
					paywall={paywall}
					initialPaywallProducts={paywallProducts}
					products={products}
				/>
			</div>
		</Page>
	);
}
