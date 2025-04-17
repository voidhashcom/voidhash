import { ProjectNameForm } from "./project-name";
import { ProjectDelete } from "./project-delete";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { notFound } from "next/navigation";
import { ProjectSettingsGeneralLayout } from "./project-settings-general-layout";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";

export async function ProjectSettingsGeneralPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const serviceContext = await createNextServiceContext();

	const project = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: {
			organizationSlug: organizationSlug,
			projectSlug: projectSlug,
		},
	});

	if (!project) {
		return notFound();
	}

	return (
		<ProjectSettingsGeneralLayout>
			<ProjectNameForm key={projectSlug} project={project} />
			<ProjectDelete projectId={project.id} />
		</ProjectSettingsGeneralLayout>
	);
}
