import { getEnvironment } from "@/lib/services/environments/utils";
import { NavProjectEnvironmentToggle } from "./nav-project-environment-toggle";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { Suspense } from "react";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";

export async function NavProjectEnvironmentContent({
	organizationSlug,
	projectSlug,
}: { organizationSlug: string | null; projectSlug: string | null }) {
	if (!organizationSlug || !projectSlug) {
		return null;
	}
	const serviceContext = await createNextServiceContext();

	const [environmentResult, projectResult] = await Promise.all([
		getEnvironment(serviceContext.cookies, organizationSlug, projectSlug),
		getProjectBySlugAndOrganizationSlug({
			ctx: serviceContext,
			input: {
				organizationSlug: organizationSlug,
				projectSlug: projectSlug,
			},
		}),
	]);

	if (projectResult.isErr() || environmentResult.isErr()) {
		return null;
	}

	const project = projectResult.value;
	const environment = environmentResult.value;

	return (
		<div>
			<NavProjectEnvironmentToggle
				environment={environment ?? "testing"}
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
