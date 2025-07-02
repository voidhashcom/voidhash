import { SidebarInset } from "@voidhash/ui";
import { OrganizationSidebar } from "@/features/shell/organization-sidebar";
import { OrganizationSettingsSidebar } from "@/features/shell/organization-settings-sidebar";
import { LayoutSidebar } from "./layout-sidebar";
import { NavBar } from "@/features/shell";
import { Suspense } from "react";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { Effect } from "effect";
import { ProjectService } from "@/lib/services/projects/project.service";

async function OrganizationSettingsLayoutSidebar({
	organizationSlug,
}: {
	organizationSlug: string;
}) {
	const data = await runServerEffect(Effect.gen(function* () {
		const projectService = yield* ProjectService;
		const projects = yield* projectService.getProjectsByOrganizationSlug(organizationSlug);
		return { projects };
	}));

	if (data.isErr()) {
		return null;
	}

	const { projects } = data.value;

	return (
		<OrganizationSettingsSidebar
			projects={projects ?? []}
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
