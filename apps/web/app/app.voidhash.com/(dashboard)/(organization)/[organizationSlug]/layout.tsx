import { SidebarInset } from "@voidhash/ui";
import { OrganizationSidebar } from "@/features/shell/organization-sidebar";
import { OrganizationSettingsSidebar } from "@/features/shell/organization-settings-sidebar";
import { LayoutSidebar } from "./layout-sidebar";
import { NavBar } from "@/features/shell";
import { getProjectsByOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { Suspense } from "react";

async function OrganizationSettingsLayoutSidebar({
	organizationSlug,
}: {
	organizationSlug: string;
}) {
	const projectsResult = await getProjectsByOrganizationSlug({
		ctx: await createNextServiceContext(),
		input: {
			slug: organizationSlug,
		},
	});

	if (projectsResult.isErr()) {
		return null;
	}

	const projects = projectsResult.value;

	return (
		<OrganizationSettingsSidebar
			projects={projects}
			areProjectsLoading={false}
		/>
	);
}

export default async function OrganizationLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;

	return (
		<>
			<NavBar organizationSlug={organizationSlug} projectSlug={null} />

			<div className="flex flex-1">
				<LayoutSidebar
					organizationSidebar={
						<OrganizationSidebar organizationSlug={organizationSlug} />
					}
					organizationSettingsSidebar={
						<Suspense
							fallback={
								<OrganizationSettingsSidebar
									projects={[]}
									areProjectsLoading={true}
								/>
							}
						>
							<OrganizationSettingsLayoutSidebar
								organizationSlug={organizationSlug}
							/>
						</Suspense>
					}
				/>
				<SidebarInset className="top-[var(--header-height)] transition-all duration-75">
					{children}
				</SidebarInset>
			</div>
		</>
	);
}
