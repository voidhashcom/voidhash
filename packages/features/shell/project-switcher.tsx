"use client";
import {
	GradientAvatar,
	OrganizationProjectSwitcher,
	Skeleton,
} from "@voidhash/ui";
import { useActiveProject } from "./hooks/useActiveProject";
import Link from "next/link";
import { useParams } from "next/navigation";

export function ProjectSwitcher() {
	const { organizationSlug, projectSlug } = useParams();
	const { activeProject, isLoading: isProjectLoading } = useActiveProject();

	return (
		<div className="flex items-center gap-2">
			<Link href={`/~/${organizationSlug}/${projectSlug}`}>
				<div className="flex items-center gap-2">
					{isProjectLoading ? (
						<Skeleton className="h-6 w-6 rounded-lg" />
					) : activeProject ? (
						<GradientAvatar
							className="h-6 w-6 rounded-lg text-xs"
							src={undefined}
							alt={activeProject.name}
							fallback={activeProject.id}
						/>
					) : null}
					{activeProject && (
						<span className="truncate text-sm text-foreground-">
							{activeProject.name}
						</span>
					)}
				</div>
			</Link>
			<OrganizationProjectSwitcher />
		</div>
	);
}
