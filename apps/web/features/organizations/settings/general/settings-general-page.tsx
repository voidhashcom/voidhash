import { TeamNameForm } from "./team-name";
import { TeamDelete } from "./team-delete";
import { SettingsGeneralLayout } from "./settings-general-layout";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { OrganizationService } from "@/lib/services/organization.service";
import { Effect } from "effect";
import { NotFoundError } from "@/lib/effect/errors";
import { AuthService, AuthSession } from "@/lib/services/auth.service";

export default async function GeneralSettingsPage({
	params,
}: {
	params: { organizationSlug: string };
}) {
	const { organizationSlug } = params;
	const data = await runServerEffect(
		Effect.gen(function* () {
			const authService = yield* AuthService;
			const authSession = yield* authService.authenticateWithSession();
			return yield* AuthSession.provide(authSession)(
				Effect.gen(function* () {
					const organizationService = yield* OrganizationService;
					const activeOrganization = yield* organizationService
						.getOrganizationBySlug(organizationSlug)
						.pipe(
							Effect.catchTags({
								OrganizationNotFound: () =>
									Effect.fail(
										new NotFoundError({
											message: "Organization not found",
										}),
									),
							}),
						);

					return { activeOrganization };
				}),
			);
		}),
	);

	if (data.isErr()) {
		const error = data._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const { activeOrganization } = data.value;

	return (
		<SettingsGeneralLayout>
			<TeamNameForm key={organizationSlug} organization={activeOrganization} />
			{/* <TeamUrlForm /> */}
			<TeamDelete organizationId={activeOrganization.id} />
		</SettingsGeneralLayout>
	);
}
