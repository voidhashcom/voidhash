import { TeamNameForm } from "./team-name";
import { TeamDelete } from "./team-delete";
import { SettingsGeneralLayout } from "./settings-general-layout";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { OrganizationService } from "@/lib/services/organizations/organization.service";
import { Effect } from "effect";
import { NotFoundError } from "@/lib/effect/errors";

export default async function GeneralSettingsPage({
	params,
}: { params: { organizationSlug: string } }) {
	const { organizationSlug } = params;
	const data = await runServerEffect(Effect.gen(function* () {
		const organizationService = yield* OrganizationService;
		const activeOrganization = yield* organizationService.getOrganizationBySlug(organizationSlug);
		if (!activeOrganization) {
			return yield* Effect.fail(new NotFoundError({
				message: "Organization not found",
			}));
		}
		return { activeOrganization };
	}));

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
