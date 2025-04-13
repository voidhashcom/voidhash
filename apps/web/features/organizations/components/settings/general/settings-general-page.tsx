import { notFound } from "next/navigation";
import { Page } from "@/features/shell";
import { TeamNameForm } from "./team-name";
import { getOrganizationBySlug } from "@/features/organizations/server/cached-queries";
import { TeamDelete } from "./team-delete";

export default async function GeneralSettingsPage({
	params,
}: { params: { organizationSlug: string } }) {
	const { organizationSlug } = params;
	const activeOrganization = await getOrganizationBySlug(organizationSlug);

	if (!activeOrganization) {
		return notFound();
	}

	return (
		<Page
			breadcrumbs={[
				{ title: "Settings", url: "/settings" },
				{ title: "Team", url: "/settings/team" },
				{ title: "Members", url: "/settings/team/members" },
			]}
		>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">Team Settings</h1>
				<p className="text-muted-foreground mt-3">All settings for team</p>

				<TeamNameForm
					key={organizationSlug}
					organization={activeOrganization}
				/>
				{/* <TeamUrlForm /> */}
				<TeamDelete organizationId={activeOrganization.id} />
			</div>
		</Page>
	);
}
