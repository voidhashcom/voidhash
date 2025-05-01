import { Page } from "@/features/shell";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { notFound } from "next/navigation";
import { Card } from "@voidhash/ui";
import { getPaywallLocations } from "@/lib/services/paywall-locations/queries";
import { CreatePaywallLocationModalButton } from "./create-paywall-location-modal-button";
import { PaywallLocationsPageEmptyState } from "./paywall-locations-page-empty-state";
import { PaywallLocationRecord } from "./paywall-location-record";
import { getPaywalls } from "@/lib/services/paywalls/queries";

export async function PaywallLocationsPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const serviceContext = await createNextServiceContext();
	const project = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { projectSlug: projectSlug, organizationSlug },
	});

	if (!project) {
		return notFound();
	}

	const paywallsPromise = getPaywalls({
		ctx: serviceContext,
		input: { projectId: project.id },
	});

	const paywallLocationsPromise = getPaywallLocations({
		ctx: serviceContext,
		input: { projectId: project.id },
	});

	const [paywalls, paywallLocations] = await Promise.all([
		paywallsPromise,
		paywallLocationsPromise,
	]);

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">
						Paywall Locations
					</h1>
					{paywallLocations.length > 0 && (
						<CreatePaywallLocationModalButton
							projectId={project.id}
							paywalls={paywalls}
						/>
					)}
				</div>{" "}
				<p className="text-muted-foreground mt-3">List of paywall locations.</p>
				<div className="mt-8">
					{paywallLocations.length === 0 ? (
						<PaywallLocationsPageEmptyState
							projectId={project.id}
							paywalls={paywalls}
						/>
					) : (
						<Card className="divide-y grid p-0 gap-0">
							{paywallLocations.map((paywallLocation) => (
								<PaywallLocationRecord
									key={paywallLocation.id}
									paywallLocation={paywallLocation}
									organizationSlug={organizationSlug}
									projectSlug={projectSlug}
									paywalls={paywalls}
								/>
							))}
						</Card>
					)}
				</div>
			</div>
		</Page>
	);
}
