import { TeamNameForm } from "./team-name";
import { getOrganizationBySlug } from "@/lib/services/organizations/queries";
import { TeamDelete } from "./team-delete";
import { SettingsGeneralLayout } from "./settings-general-layout";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";

export default async function GeneralSettingsPage({
	params,
}: { params: { organizationSlug: string } }) {
	const { organizationSlug } = params;
	const activeOrganizationResult = await getOrganizationBySlug({
		ctx: await createNextServiceContext(),
		input: {
			slug: organizationSlug,
		},
	});

	if (activeOrganizationResult.isErr()) {
		const error = activeOrganizationResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const activeOrganization = activeOrganizationResult.value;

	return (
		<SettingsGeneralLayout>
			<TeamNameForm key={organizationSlug} organization={activeOrganization} />
			{/* <TeamUrlForm /> */}
			<TeamDelete organizationId={activeOrganization.id} />
		</SettingsGeneralLayout>
	);
}
