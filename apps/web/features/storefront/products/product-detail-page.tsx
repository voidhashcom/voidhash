import { Page } from "@/features/shell";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { getPaymentProviderConfigurations } from "@/lib/services/payment-providers/queries";
import { getProductById } from "@/lib/services/products/queries";
import { notFound } from "next/navigation";

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

	const paymentProviderConfigurations = await getPaymentProviderConfigurations({
		ctx: await createNextServiceContext(),
		input: { projectId: product.projectId },
	});

	const paymentProvidersWithEnabledConfigurations = paymentProviders
		.map((paymentProvider) => {
			const paymentProviderConfiguration = paymentProviderConfigurations.find(
				(paymentProviderConfiguration) =>
					paymentProviderConfiguration.providerId === paymentProvider.id
			);

			return {
				...paymentProvider,
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
					{paymentProvidersWithEnabledConfigurations.map((paymentProvider) => (
						<div key={paymentProvider.id}>{paymentProvider.title}</div>
					))}
				</div>
			</div>
		</Page>
	);
}
