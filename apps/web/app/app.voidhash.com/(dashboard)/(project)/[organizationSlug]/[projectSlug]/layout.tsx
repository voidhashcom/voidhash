import { NavBar } from "@/features/shell";
import { LayoutSidebar } from "./layout-sidebar";
import { SidebarInset } from "@voidhash/ui";
import { ProjectSidebar } from "@/features/shell/project-sidebar";
import { ProjectSettingsSidebar } from "@/features/shell/project-settings-sidebar";
import { getOrganizationBySlug } from "@/lib/services/organizations/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { Suspense } from "react";

async function ProjectLayoutSidebar({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const activeOrganizationResult = await getOrganizationBySlug({
		ctx: await createNextServiceContext(),
		input: {
			slug: organizationSlug,
		},
	});

	if (activeOrganizationResult.isErr()) {
		return null;
	}

	const activeOrganization = activeOrganizationResult.value;

	return (
		<ProjectSettingsSidebar
			organizationSlug={organizationSlug}
			projectSlug={projectSlug}
			activeOrganization={activeOrganization}
			isActiveOrganizationLoading={false}
		/>
	);
}

export default async function ProjectLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ organizationSlug: string; projectSlug: string }>;
}) {
	const { organizationSlug, projectSlug } = await params;

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
						<Suspense
							fallback={
								<ProjectSettingsSidebar
									organizationSlug={organizationSlug}
									projectSlug={projectSlug}
									activeOrganization={null}
									isActiveOrganizationLoading={true}
								/>
							}
						>
							<ProjectLayoutSidebar
								organizationSlug={organizationSlug}
								projectSlug={projectSlug}
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
