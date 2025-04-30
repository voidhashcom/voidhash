import { Page } from "@/features/shell";
import { Badge, Card } from "@voidhash/ui";
import Link from "next/link";
import { PaymentProviderLogo } from "./payment-provider-logo";
import { ChevronRightIcon } from "lucide-react";
// import { StripeConfigurationSheet } from "./stripe/stripe-configuration-sheet";
// import { AppStoreConfigurationSheet } from "./app-store/app-store-configuration-sheet";
import { getPaymentProviderConfigurations } from "@/lib/services/payment-providers/queries";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { notFound } from "next/navigation";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { PaymentProviderConfigurationSheet } from "./payment-provider-configuration-sheet";

// const paymentProvidersConfigurationSheetComponents = {
// 	stripe: StripeConfigurationSheet,
// 	"app-store": AppStoreConfigurationSheet,
// } as const;

export async function PaymentProvidersPage({
	paramsPromise,
}: {
	paramsPromise: Promise<{
		organizationSlug: string;
		projectSlug: string;
	}>;
}) {
	const { organizationSlug, projectSlug } = await paramsPromise;

	const serviceContext = await createNextServiceContext();
	const project = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: {
			organizationSlug: organizationSlug,
			projectSlug: projectSlug,
		},
	});

	if (!project) {
		return notFound();
	}

	const paymentProvidersConfigurations = await getPaymentProviderConfigurations(
		{
			ctx: serviceContext,
			input: {
				projectId: project?.id,
			},
		}
	);

	const paymentProvidersWithConfigurations = paymentProviders.map(
		(paymentProvider) => {
			const paymentProvidersConfiguration =
				paymentProvidersConfigurations?.find(
					(p) => p.providerId === paymentProvider.id
				);
			return {
				...paymentProvider,
				configuration: paymentProvidersConfiguration?.configuration,
				enabled: paymentProvidersConfiguration?.enabled,
			};
		}
	);

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">
					Payment Providers
				</h1>
				<p className="text-muted-foreground mt-3">
					Configure your payment providers.
				</p>
				<div className="mt-8">
					<Card className="divide-y grid p-0 gap-0">
						{paymentProvidersWithConfigurations?.map((paymentProvider) => (
							<div
								className="relative isolate group hover:bg-accent/30 px-6 py-4"
								key={paymentProvider.id}
							>
								<PaymentProviderConfigurationSheet
									providerId={paymentProvider.id}
									enabled={paymentProvider.enabled ?? false}
									configuration={paymentProvider.configuration}
									project={project}
									trigger={
										<Link
											className="inset-0 absolute w-full h-full"
											href={`/${organizationSlug}/${projectSlug}/monetization/payment-providers`}
										></Link>
									}
								/>

								<div className="flex flex-row items-center justify-between">
									<div className="flex items-center gap-4 flex-1">
										<div className="w-8 h-8 flex items-center justify-center">
											<PaymentProviderLogo
												providerId={paymentProvider.id}
												className="w-full h-full"
											/>
										</div>
										<div className="flex flex-col">
											<p>{paymentProvider.title}</p>
										</div>
									</div>
									<div className="flex items-center gap-2">
										{paymentProvider.enabled && <Badge>Enabled</Badge>}
										<ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
									</div>
								</div>
							</div>
						))}
					</Card>
				</div>
			</div>
		</Page>
	);
}
