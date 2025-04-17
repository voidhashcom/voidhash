import { ProjectNameForm } from "./project-name";
import { ProjectDelete } from "./project-delete";
import { getProjectBySlug } from "@/lib/services/projects/queries";
import { notFound } from "next/navigation";
import { ProjectSettingsGeneralLayout } from "./project-settings-general-layout";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";

export async function ProjectSettingsGeneralPage({
	projectSlug,
}: {
	projectSlug: string;
}) {
	const serviceContext = await createNextServiceContext();
	const project = await getProjectBySlug({
		ctx: serviceContext,
		input: {
			slug: projectSlug,
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
