import { Link, useParams } from "@tanstack/react-router";
import { Badge, Card, Skeleton } from "@voidhash/ui";
import { ChevronRightIcon } from "lucide-react";
import { StripeConfigurationSheet } from "../../providers/stripe/stripe-configuration-sheet";
import { paymentProviders } from "../../config";
import { paymentProvidersConfigurationsQueryOptions } from "../../providers/stripe/client/query-utils";
import { useQuery } from "@tanstack/react-query";
import { useActiveProject } from "../../../shell/hooks/useActiveProject";

export function PaymentProvidersList() {
	const { organizationSlug, projectSlug } = useParams({
		strict: false,
	});

	const activeProject = useActiveProject();

	const { data: paymentProvidersConfigurations, status } = useQuery(
		paymentProvidersConfigurationsQueryOptions(activeProject?.id)
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

	if (status === "pending") {
		return (
			<Card className="divide-y grid p-0 gap-0">
				{paymentProviders?.map((paymentProvider) => (
					<div
						className="relative isolate group hover:bg-accent/30 px-6 py-4"
						key={paymentProvider.id}
					>
						<div className="flex flex-row items-center justify-between">
							<div className="flex items-center gap-4 flex-1">
								<div className="w-8 h-8">
									<Skeleton className="w-full h-full" />
								</div>
								<div className="flex flex-col">
									<Skeleton className="w-64 h-4" />
								</div>
							</div>
						</div>
					</div>
				))}
			</Card>
		);
	}

	return (
		<Card className="divide-y grid p-0 gap-0">
			{paymentProvidersWithConfigurations?.map((paymentProvider) => (
				<div
					className="relative isolate group hover:bg-accent/30 px-6 py-4"
					key={paymentProvider.id}
				>
					<StripeConfigurationSheet
						enabled={paymentProvider.enabled ?? false}
						configuration={paymentProvider.configuration}
						trigger={
							<Link
								className="inset-0 absolute w-full h-full"
								to="/~/$organizationSlug/$projectSlug/settings/payment-providers"
								params={{
									organizationSlug,
									projectSlug,
								}}
							></Link>
						}
					/>

					<div className="flex flex-row items-center justify-between">
						<div className="flex items-center gap-4 flex-1">
							<div className="w-8 h-8">
								<paymentProvider.logo className="w-full h-full" />
							</div>
							<div className="flex flex-col">
								<p>{paymentProvider.title}</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							{paymentProvider.enabled && (
								<Badge variant="outline">Enabled</Badge>
							)}
							<ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
						</div>
					</div>
				</div>
			))}
		</Card>
	);
}
