import { ProjectNameForm } from "./project-name";
import { ProjectDelete } from "./project-delete";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";

import { ProjectSettingsGeneralLayout } from "./project-settings-general-layout";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";

export async function ProjectSettingsGeneralPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const serviceContext = await createNextServiceContext();

	const projectResult = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: {
			organizationSlug: organizationSlug,
			projectSlug: projectSlug,
		},
	});

	if (projectResult.isErr()) {
		const error = projectResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const project = projectResult.value;

	return (
		<ProjectSettingsGeneralLayout>
			<ProjectNameForm key={projectSlug} project={project} />
			<ProjectDelete projectId={project.id} />
		</ProjectSettingsGeneralLayout>
	);
}
