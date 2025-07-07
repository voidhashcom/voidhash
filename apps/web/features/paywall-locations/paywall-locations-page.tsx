import { Card } from "@voidhash/ui";
import { CreatePaywallLocationModalButton } from "./create-paywall-location-modal-button";
import { PaywallLocationsPageEmptyState } from "./paywall-locations-page-empty-state";
import { PaywallLocationRecord } from "./paywall-location-record";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { PaywallLocationService } from "@/lib/services/paywall-location.service";
import { Effect } from "effect";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { NotFoundError } from "@/lib/effect/errors";
import { ProjectService } from "@/lib/services/project.service";
import { PaywallService } from "@/lib/services/paywall.service";
import { AuthService, AuthSession } from "@/lib/services/auth.service";
import {
	Environment,
	EnvironmentService,
} from "@/lib/services/environment.service";

export async function PaywallLocationsPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const data = await runServerEffect(
		Effect.gen(function* () {
			const authService = yield* AuthService;
			const projectService = yield* ProjectService;
			const paywallLocationService = yield* PaywallLocationService;
			const paywallService = yield* PaywallService;
			const environmentService = yield* EnvironmentService;
			const authSession = yield* authService.authenticateWithSession();
			return yield* AuthSession.provide(authSession)(
				Effect.gen(function* () {
					const environment =
						yield* environmentService.getEnvironmentFromCookie({
							organizationSlug,
							projectSlug,
						});
					return yield* Environment.provide(environment)(
						Effect.gen(function* () {
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
							const paywalls = yield* paywallService.getPaywalls(project.id);
							const paywallLocations =
								yield* paywallLocationService.getPaywallLocations(project.id);
							return { project, paywalls, paywallLocations };
						})
					);
				})
			);
		})
	);

	if (data.isErr()) {
		const error = data._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const { project, paywalls, paywallLocations } = data.value;

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
