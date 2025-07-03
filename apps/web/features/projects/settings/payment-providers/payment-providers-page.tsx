import { Page } from "@/features/shell";
import { Badge, Card, CardHeader, CardTitle, cn } from "@voidhash/ui";
import Link from "next/link";
import { PaymentProviderLogo } from "./payment-provider-logo";
import { ChevronRightIcon } from "lucide-react";
// import { StripeConfigurationSheet } from "./stripe/stripe-configuration-sheet";
// import { AppStoreConfigurationSheet } from "./app-store/app-store-configuration-sheet";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { EnvironmentFilterNotification } from "@/features/shell/components/environment-filter-notification";
import { PaymentProvidersNewStoreDropdown } from "./payment-providers-new-store-dropdown";
import { SetupPaymentProviderButton } from "./setup-payment-provider-button";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { Effect } from "effect";
import { ProjectService } from "@/lib/services/projects/project.service";
import { Environment } from "@/lib/effect/environment";
import { PaymentProviderService } from "@/lib/services/payment-providers/payment-provider.service";
import { NotFoundError } from "@/lib/effect/errors";
import { AuthSession } from "@/lib/effect/auth";
import { Environment as EnvironmentEnum } from "@voidhash/lib/index";

export async function PaymentProvidersPage({
	paramsPromise,
}: {
	paramsPromise: Promise<{
		organizationSlug: string;
		projectSlug: string;
	}>;
}) {
	const { organizationSlug, projectSlug } = await paramsPromise;

	const data = await runServerEffect(
		AuthSession.withAuthSession()(
			Environment.withEnvironment({
				organizationSlug,
				projectSlug,
			})(
				Effect.gen(function* () {
					const projectService = yield* ProjectService;
					const paymentProviderService = yield* PaymentProviderService;
					const environment = yield* Environment;
					const project =
						yield* projectService.getProjectBySlugAndOrganizationSlug({
							organizationSlug,
							projectSlug,
						});
					if (!project) {
						return yield* Effect.fail(
							new NotFoundError({
								message: "Project not found",
							})
						);
					}
					const paymentProviderConfigurations =
						yield* paymentProviderService.getPaymentProviderConfigurations(
							project.id
						);

					return { project, environment, paymentProviderConfigurations };
				})
			)
		)
	);

	if (data.isErr()) {
		const error = data._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const { project, environment, paymentProviderConfigurations } = data.value;

	const applicationsWithConfiguration = paymentProviderConfigurations
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
		.filter((p) => p.getType() === "web-checkout" && p.getIsConfigurable())
		.map((paymentProvider) => {
			const paymentProvidersConfiguration = paymentProviderConfigurations?.find(
				(p) => p.providerId === paymentProvider.getId()
			);
			return {
				...paymentProvidersConfiguration,
				provider: paymentProvider,
			};
		});

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

				{environment === EnvironmentEnum.Testing && (
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
						{webCheckoutProvidersWithConfigurations?.map(
							(paymentProviderConfiguration) => (
								<div
									className="relative isolate group hover:bg-accent/30 px-6 py-4"
									key={
										paymentProviderConfiguration.id ??
										paymentProviderConfiguration.provider.getId()
									}
								>
									{paymentProviderConfiguration.id &&
										paymentProviderConfiguration.provider.getIsConfigurable() && (
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
