import { notFound } from "next/navigation";
import { TeamNameForm } from "./team-name";
import { getOrganizationBySlug } from "@/lib/services/organizations/queries";
import { TeamDelete } from "./team-delete";
import { SettingsGeneralLayout } from "./settings-general-layout";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";

export default async function GeneralSettingsPage({
	params,
}: { params: { organizationSlug: string } }) {
	const { organizationSlug } = params;
	const activeOrganization = await getOrganizationBySlug({
		ctx: await createNextServiceContext(),
		input: {
			slug: organizationSlug,
		},
	});

	if (!activeOrganization) {
		return notFound();
	}

	return (
		<SettingsGeneralLayout>
			<TeamNameForm key={organizationSlug} organization={activeOrganization} />
			{/* <TeamUrlForm /> */}
			<TeamDelete organizationId={activeOrganization.id} />
		</SettingsGeneralLayout>
	);
}
