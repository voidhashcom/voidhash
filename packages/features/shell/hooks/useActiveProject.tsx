"use client";
import { useParams } from "next/navigation";
import { useActiveOrganizationProjects } from "./useActiveOrganizationProjects";
export function useActiveProject() {
	const { projectSlug } = useParams();
	const { data } = useActiveOrganizationProjects();
	const activeProject = (data ?? []).find(
		(project) => project.slug === projectSlug
	);
	return activeProject;
}
