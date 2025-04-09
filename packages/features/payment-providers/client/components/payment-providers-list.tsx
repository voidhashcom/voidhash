import { Badge, Card, Skeleton } from "@voidhash/ui";
import { ChevronRightIcon } from "lucide-react";
import { StripeConfigurationSheet } from "../../providers/stripe/stripe-configuration-sheet";
import { useQuery } from "@tanstack/react-query";
import { useActiveProject } from "../../../shell/hooks/useActiveProject";
import { AppStoreConfigurationSheet } from "../../providers/app-store/app-store-configuration-sheet";
import { paymentProviders } from "@voidhash/lib";
import { useTRPC } from "../../../trpc/react";
import { PaymentProviderLogo } from "./payment-provider-logo";
import { useParams } from "next/navigation";
import Link from "next/link";

const paymentProvidersConfigurationSheetComponents = {
	stripe: StripeConfigurationSheet,
	"app-store": AppStoreConfigurationSheet,
} as const;

export function PaymentProvidersList() {
	const { organizationSlug, projectSlug } = useParams();

	const { activeProject } = useActiveProject();

	const trpc = useTRPC();
	const { data: paymentProvidersConfigurations, status } = useQuery(
		trpc.paymentProviders.paymentProvidersConfigurations.queryOptions(
			{
				projectId: activeProject?.id ?? "",
			},
			{
				enabled: !!activeProject?.id,
			}
		)
	);

	const paymentProvidersWithConfigurations = paymentProviders.map(
		(paymentProvider) => {
			const paymentProvidersConfiguration =
				paymentProvidersConfigurations?.find(
					(p) => p.providerId === paymentProvider.id
				);
			return {
				...paymentProvider,
				ConfigurationSheet:
					paymentProvidersConfigurationSheetComponents[paymentProvider.id],
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
					<paymentProvider.ConfigurationSheet
						enabled={paymentProvider.enabled ?? false}
						configuration={paymentProvider.configuration}
						trigger={
							<Link
								className="inset-0 absolute w-full h-full"
								href={`/~/${organizationSlug}/${projectSlug}/settings/payment-providers`}
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
