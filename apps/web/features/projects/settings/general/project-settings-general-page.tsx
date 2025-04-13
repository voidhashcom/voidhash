import { ProjectNameForm } from "./project-name";
import { ProjectDelete } from "./project-delete";
import { getProjectBySlug } from "@/lib/queries/cached-queries";
import { notFound } from "next/navigation";
import { ProjectSettingsGeneralLayout } from "./project-settings-general-layout";

export async function ProjectSettingsGeneralPage({
	projectSlug,
}: {
	projectSlug: string;
}) {
	const project = await getProjectBySlug(projectSlug);

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
