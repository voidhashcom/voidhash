import { NavBar } from "@/features/shell";
import { LayoutSidebar } from "./layout-sidebar";
import { SidebarInset } from "@voidhash/ui";
import { ProjectSidebar } from "@/features/shell/project-sidebar";
import { ProjectSettingsSidebar } from "@/features/shell/project-settings-sidebar";
import { getOrganizationBySlug } from "@/lib/services/organizations/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";

export default async function ProjectLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ organizationSlug: string; projectSlug: string }>;
}) {
	const { organizationSlug, projectSlug } = await params;
	const activeOrganizationPromise = getOrganizationBySlug({
		ctx: await createNextServiceContext(),
		input: {
			slug: organizationSlug,
		},
	});

	return (
		<>
			<NavBar organizationSlug={organizationSlug} projectSlug={projectSlug} />

			<div className="flex flex-1">
				<LayoutSidebar
					projectSidebar={
						<ProjectSidebar
							organizationSlug={organizationSlug}
							projectSlug={projectSlug}
						/>
					}
					projectSettingsSidebar={
						<ProjectSettingsSidebar
							organizationSlug={organizationSlug}
							projectSlug={projectSlug}
							activeOrganizationPromise={activeOrganizationPromise}
						/>
					}
				/>
				<SidebarInset className="top-[var(--header-height)]">
					{children}
				</SidebarInset>
			</div>
		</>
	);
}
