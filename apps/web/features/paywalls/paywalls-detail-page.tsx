import { Page } from "@/features/shell";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import {
	getPaywallById,
	getPaywallProducts,
} from "@/lib/services/paywalls/queries";
import { getProducts } from "@/lib/services/products/queries";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { PaywallDetailPageEditor } from "./paywall-detail-page-editor";

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
