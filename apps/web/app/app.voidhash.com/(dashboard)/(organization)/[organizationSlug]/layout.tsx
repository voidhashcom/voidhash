import { SidebarInset } from "@voidhash/ui";
import { OrganizationSidebar } from "@/features/shell/organization-sidebar";
import { OrganizationSettingsSidebar } from "@/features/shell/organization-settings-sidebar";
import { LayoutSidebar } from "./layout-sidebar";
import { NavBar } from "@/features/shell";
import { getProjectsByOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";

export default async function OrganizationLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ organizationSlug: string }>;
}) {
	const { organizationSlug } = await params;
	const projectsPromise = getProjectsByOrganizationSlug({
		ctx: await createNextServiceContext(),
		input: {
			slug: organizationSlug,
		},
	});

	return (
		<>
			<NavBar organizationSlug={organizationSlug} projectSlug={null} />

			<div className="flex flex-1">
				<LayoutSidebar
					organizationSidebar={
						<OrganizationSidebar organizationSlug={organizationSlug} />
					}
					organizationSettingsSidebar={
						<OrganizationSettingsSidebar projectsPromise={projectsPromise} />
					}
				/>
				<SidebarInset className="top-[var(--header-height)]">
					{children}
				</SidebarInset>
			</div>
		</>
	);
}
