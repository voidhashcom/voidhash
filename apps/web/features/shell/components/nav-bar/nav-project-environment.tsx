import { getEnvironment } from "@/lib/environments/utils";
import { NavProjectEnvironmentToggle } from "./nav-project-environment-toggle";
import { getProjectBySlug } from "@/lib/queries/cached-queries";
import { Suspense } from "react";

export async function NavProjectEnvironmentContent({
	organizationSlug,
	projectSlug,
}: { organizationSlug: string | null; projectSlug: string | null }) {
	if (!organizationSlug || !projectSlug) {
		return null;
	}
	const [environment, project] = await Promise.all([
		getEnvironment(organizationSlug, projectSlug),
		getProjectBySlug(projectSlug),
	]);

	if (!project) {
		return null;
	}
	return (
		<div>
			<NavProjectEnvironmentToggle
				environment={environment}
				projectId={project.id}
			/>
		</div>
	);
}

export async function NavProjectEnvironment({
	organizationSlug,
	projectSlug,
}: { organizationSlug: string | null; projectSlug: string | null }) {
	return (
		<Suspense fallback={<div></div>}>
			<NavProjectEnvironmentContent
				organizationSlug={organizationSlug}
				projectSlug={projectSlug}
			/>
		</Suspense>
	);
}
