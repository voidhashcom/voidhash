import { GradientAvatar, OrganizationProjectSwitcher } from "@voidhash/ui";
import { useActiveProject } from "./hooks/useActiveProject";
import { useActiveOrganization } from "./hooks/useActiveOrganization";
import Link from "next/link";

export function ProjectSwitcher() {
	const activeOrganization = useActiveOrganization();
	const activeProject = useActiveProject();

	if (!activeOrganization || !activeProject) {
		return null;
	}

	return (
		<div className="flex items-center gap-2">
			<Link href={`/~/${activeOrganization.slug}/${activeProject.slug}`}>
				<div className="flex items-center gap-2">
					<GradientAvatar
						className="h-6 w-6 rounded-lg text-xs"
						src={undefined}
						alt={activeProject.name}
						fallback={activeProject.id}
					/>
					<span className="truncate text-sm text-foreground-">
						{activeProject.name}
					</span>
				</div>
			</Link>
			<OrganizationProjectSwitcher />
		</div>
	);
}
