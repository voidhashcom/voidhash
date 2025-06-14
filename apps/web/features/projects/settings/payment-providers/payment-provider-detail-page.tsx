import { Page } from "@/features/shell";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { getPaymentProviderConfigurationById } from "@/lib/services/payment-providers/queries";
import { PaymentProviderDetailConfiguration } from "./payment-provider-detail-configuration";

export async function PaymentProviderDetailPage({
	paramsPromise,
}: {
	paramsPromise: Promise<{
		paymentProviderConfigurationId: string;
		organizationSlug: string;
		projectSlug: string;
	}>;
}) {
	const { organizationSlug, projectSlug, paymentProviderConfigurationId } =
		await paramsPromise;

	const serviceContext = await createNextServiceContext();
	const paymentProviderConfigurationPromise =
		getPaymentProviderConfigurationById({
			ctx: serviceContext,
			input: {
				id: paymentProviderConfigurationId,
			},
		});
	const projectPromise = getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: {
			organizationSlug: organizationSlug,
			projectSlug: projectSlug,
		},
	});

	const [projectResult, paymentProviderConfigurationResult] = await Promise.all(
		[
			projectPromise,

			paymentProviderConfigurationPromise,
		]
	);
	if (projectResult.isErr() || paymentProviderConfigurationResult.isErr()) {
		const error = projectResult.isErr()
			? projectResult._unsafeUnwrapErr()
			: paymentProviderConfigurationResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const project = projectResult.value;
	const paymentProviderConfiguration = paymentProviderConfigurationResult.value;

	return (
		<Page
			className="p-0 pb-0  pt-3 flex flex-col flex-1"
			breadcrumbs={[
				{
					title: "Payment Providers",
					url: `/${organizationSlug}/${projectSlug}/settings/payment-providers`,
				},
				{
					title: paymentProviderConfiguration.name,
					url: `/${organizationSlug}/${projectSlug}/settings/payment-providers/${paymentProviderConfiguration.id}`,
				},
			]}
		>
			<PaymentProviderDetailConfiguration
				organizationSlug={organizationSlug}
				projectSlug={projectSlug}
				paymentProviderConfiguration={paymentProviderConfiguration}
				project={project}
			/>
		</Page>
	);
}
