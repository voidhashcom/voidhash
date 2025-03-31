import { useParams } from "@tanstack/react-router";
import { useActiveOrganizationProjects } from "./useActiveOrganizationProjects";
export function useActiveProject() {
	const { projectSlug } = useParams({ strict: false });
	const { data } = useActiveOrganizationProjects();
	const activeProject = (data ?? []).find(
		(project) => project.slug === projectSlug
	);
	return activeProject;
}
