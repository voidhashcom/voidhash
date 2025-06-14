import { Page } from "@/features/shell";
import { Badge, Card, CardHeader, CardTitle, cn } from "@voidhash/ui";
import Link from "next/link";
import { PaymentProviderLogo } from "./payment-provider-logo";
import { ChevronRightIcon } from "lucide-react";
// import { StripeConfigurationSheet } from "./stripe/stripe-configuration-sheet";
// import { AppStoreConfigurationSheet } from "./app-store/app-store-configuration-sheet";
import { getPaymentProviderConfigurations } from "@/lib/services/payment-providers/queries";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { EnvironmentFilterNotification } from "@/features/shell/components/environment-filter-notification";
import { getEnvironment } from "@/lib/services/environments/utils";
import { PaymentProvidersNewStoreDropdown } from "./payment-providers-new-store-dropdown";
import { SetupPaymentProviderButton } from "./setup-payment-provider-button";

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
	const projectPromise = getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: {
			organizationSlug: organizationSlug,
			projectSlug: projectSlug,
		},
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

	const paymentProvidersConfigurationsResult =
		await getPaymentProviderConfigurations({
			ctx: serviceContext,
			input: {
				projectId: project.id,
			},
		});

	if (paymentProvidersConfigurationsResult.isErr()) {
		const error = paymentProvidersConfigurationsResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const paymentProvidersConfigurations =
		paymentProvidersConfigurationsResult.value;

	const applicationsWithConfiguration = paymentProvidersConfigurations
		.map((p) => {
			const paymentProvider = paymentProviders.find(
				(pp) => pp.getId() === p.providerId
			);
			if (!paymentProvider || paymentProvider.getType() !== "native") {
				return null;
			}
			return {
				...p,
				provider: paymentProvider,
			};
		})
		.filter(Boolean);

	const webCheckoutProvidersWithConfigurations = paymentProviders
		.filter((p) => p.getType() === "web-checkout")
		.map((paymentProvider) => {
			const paymentProvidersConfiguration =
				paymentProvidersConfigurations?.find(
					(p) => p.providerId === paymentProvider.getId()
				);
			return {
				...paymentProvidersConfiguration,
				provider: paymentProvider,
			};
		})
		.filter((c) => c.provider.getIsConfigurable());

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

				{environment === "testing" && (
					<EnvironmentFilterNotification
						message="Payment providers configured here are shared between development and production environments. Please proceed with caution."
						className="mt-6"
						type="testing"
					/>
				)}

				<div className="mt-8">
					<Card className={cn("divide-y grid p-0 gap-0")}>
						<CardHeader
							className={cn(
								"pr-3 gap-0",
								applicationsWithConfiguration.length > 0 ? "py-3" : "py-6"
							)}
						>
							<div className="flex justify-between items-center">
								<CardTitle>Stores</CardTitle>
								{applicationsWithConfiguration.length > 0 && (
									<PaymentProvidersNewStoreDropdown
										project={project}
										organizationSlug={organizationSlug}
										projectSlug={projectSlug}
									/>
								)}
							</div>
						</CardHeader>
						{applicationsWithConfiguration.length === 0 && (
							<div className="flex flex-col items-center justify-center h-full py-6">
								<div className="text-muted-foreground">
									You haven&apos;t configured any stores for this project.
								</div>
								<div className="mt-4">
									<PaymentProvidersNewStoreDropdown
										project={project}
										organizationSlug={organizationSlug}
										projectSlug={projectSlug}
									/>
								</div>
							</div>
						)}

						{applicationsWithConfiguration?.map(
							(paymentProviderConfiguration) =>
								!paymentProviderConfiguration?.provider ? null : (
									<div
										className="relative isolate group hover:bg-accent/30 px-6 py-4"
										key={paymentProviderConfiguration.id}
									>
										{/* <PaymentProviderConfigurationSheet
											providerId={paymentProviderConfiguration.provider.getId()}
											enabled={paymentProviderConfiguration.enabled ?? false}
											configuration={paymentProviderConfiguration.configuration}
											project={project}
											name={
												paymentProviderConfiguration.name ??
												paymentProviderConfiguration.provider.getTitle()
											}
											id={paymentProviderConfiguration.id}
											trigger={
												<Link
													className="inset-0 absolute w-full h-full"
													href={`/${organizationSlug}/${projectSlug}/settings/payment-providers`}
												></Link>
											}
										/> */}

										<Link
											className="inset-0 absolute w-full h-full"
											href={`/${organizationSlug}/${projectSlug}/settings/payment-providers/${paymentProviderConfiguration.id}`}
										></Link>

										<div className="flex flex-row items-center justify-between">
											<div className="flex items-center gap-4 flex-1">
												<div className="w-8 h-8 flex items-center justify-center">
													<PaymentProviderLogo
														providerId={paymentProviderConfiguration.provider.getId()}
														className="w-full h-full"
													/>
												</div>
												<div className="flex flex-col">
													<p>{paymentProviderConfiguration.name}</p>
												</div>
											</div>
											<div className="flex items-center gap-2">
												{paymentProviderConfiguration.enabled && (
													<Badge>Enabled</Badge>
												)}
												<ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
											</div>
										</div>
									</div>
								)
						)}
					</Card>
				</div>

				<div className="mt-8">
					<Card className={cn("divide-y grid p-0 gap-0")}>
						<CardHeader className="py-6 pr-3 gap-0">
							<div className="flex justify-between items-center">
								<CardTitle>Web Checkout Providers</CardTitle>
							</div>
						</CardHeader>
						{environment === "testing" && (
							<div className="p-3 py-3 bg-card">
								<EnvironmentFilterNotification
									message="In development mode, our custom testing payment provider will be used instead of your configured payment provider."
									type="testing"
								/>
							</div>
						)}
						{webCheckoutProvidersWithConfigurations?.map(
							(paymentProviderConfiguration) => (
								<div
									className="relative isolate group hover:bg-accent/30 px-6 py-4"
									key={
										paymentProviderConfiguration.id ??
										paymentProviderConfiguration.provider.getId()
									}
								>
									{paymentProviderConfiguration.id && (
										<Link
											className="inset-0 absolute w-full h-full"
											href={`/${organizationSlug}/${projectSlug}/settings/payment-providers/${paymentProviderConfiguration.id}`}
										></Link>
									)}

									<div className="flex flex-row items-center justify-between">
										<div className="flex items-center gap-4 flex-1">
											<div className="w-8 h-8 flex items-center justify-center">
												<PaymentProviderLogo
													providerId={paymentProviderConfiguration.provider.getId()}
													className="w-full h-full"
												/>
											</div>
											<div className="flex flex-col">
												<p>
													{paymentProviderConfiguration.provider.getTitle()}
												</p>
											</div>
										</div>

										{/* If configuration exists, show the enabled/disabled badge and the chevron right */}
										{paymentProviderConfiguration.id && (
											<div className="flex items-center gap-2">
												{paymentProviderConfiguration.enabled ? (
													<Badge>Enabled</Badge>
												) : (
													<Badge variant="outline">Disabled</Badge>
												)}
												<ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
											</div>
										)}

										{/* If configuration does not exist, show the add button */}
										{!paymentProviderConfiguration.id && (
											<div className="flex items-center gap-2">
												<SetupPaymentProviderButton
													projectId={project.id}
													providerId={paymentProviderConfiguration.provider.getId()}
													organizationSlug={organizationSlug}
													projectSlug={projectSlug}
												/>
											</div>
										)}
									</div>
								</div>
							)
						)}
					</Card>
				</div>
			</div>
		</Page>
	);
}
