import { NavBar } from "@/features/shell";
import { LayoutSidebar } from "./layout-sidebar";
import { SidebarInset } from "@voidhash/ui";
import { ProjectSidebar } from "@/features/shell/project-sidebar";
import { ProjectSettingsSidebar } from "@/features/shell/project-settings-sidebar";
import { Suspense } from "react";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { Effect } from "effect";
import { OrganizationService } from "@/lib/services/organization.service";

async function ProjectLayoutSidebar({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const data = await runServerEffect(Effect.gen(function* () {
		const organizationService = yield* OrganizationService;
		const activeOrganization = yield* organizationService.getOrganizationBySlug(organizationSlug);
		return { activeOrganization };
	}));

	if (data.isErr()) {
		return null;
	}

	const { activeOrganization } = data.value;

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
