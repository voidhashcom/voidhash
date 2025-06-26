import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { Card } from "@voidhash/ui";
import { CreatePaywallLocationModalButton } from "./create-paywall-location-modal-button";
import { PaywallLocationsPageEmptyState } from "./paywall-locations-page-empty-state";
import { PaywallLocationRecord } from "./paywall-location-record";
import { getPaywalls } from "@/lib/services/paywalls/queries";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { tryCatch } from "@/lib/try-catch";
import { NextjsRuntime } from "@/lib/effect/runtimes/nextjs";
import { PaywallLocationService } from "@/lib/services/paywall-locations/paywall-location-service";
import { Effect } from "effect";

export async function PaywallLocationsPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const serviceContext = await createNextServiceContext();
	const projectResult = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { projectSlug: projectSlug, organizationSlug },
	});

	if (projectResult.isErr()) {
		const error = projectResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const project = projectResult.value;

	const paywallsPromise = getPaywalls({
		ctx: serviceContext,
		input: { projectId: project.id },
	});

	const paywallLocationsPromise = await tryCatch(
		NextjsRuntime.runPromise(
			PaywallLocationService.pipe(
				Effect.flatMap((paywallLocationService) =>
					paywallLocationService.getPaywallLocations(project.id)
				)
			)
		)
	);

	const [paywallsResult, paywallLocationsResult] = await Promise.all([
		paywallsPromise,
		paywallLocationsPromise,
	]);

	if (paywallsResult.isErr()) {
		const error = paywallsResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	if (paywallLocationsResult.error) {
		return <VoidhashErrorCard error={paywallLocationsResult.error} />;
	}

	const paywalls = paywallsResult.value;
	const paywallLocations = paywallLocationsResult.data;

	return (
		<div>
			<div className="flex flex-row items-center justify-between pt-6">
				<div>
					<h2 className="text-xl font-normal tracking-right">
						Paywall Locations
					</h2>
					<p className="text-muted-foreground mt-1">
						Places throughout your app where paywalls can be shown.
					</p>
				</div>
				{paywallLocations.length > 0 && (
					<CreatePaywallLocationModalButton
						projectId={project.id}
						paywalls={paywalls}
					/>
				)}
			</div>

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
	);
}
