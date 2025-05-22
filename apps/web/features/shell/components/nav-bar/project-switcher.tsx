import { GradientAvatar, Skeleton } from "@voidhash/ui";
import Link from "next/link";
import { NavSlashSeparator } from "./nav-slash-separator";
import { OrganizationProjectSwitcher } from "./organization-project-switcher";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { Suspense } from "react";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { getOrganizationBySlug } from "@/lib/services/organizations/queries";
import { getUser } from "@/lib/services/users/queries";
import { Project } from "@voidhash/db";

const ProjectTitle = async ({ project }: { project: Project }) => {
	return (
		<div className="flex items-center gap-2">
			<GradientAvatar
				className="h-6 w-6 rounded-lg text-xs"
				src={undefined}
				alt={project.name}
				fallback={project.id}
			/>

			<span className="truncate text-sm text-foreground-">{project.name}</span>
		</div>
	);
};

const ProjectTitleSkeleton = () => {
	return (
		<div className="flex items-center gap-2">
			<Skeleton className="h-6 w-6 rounded-full" />
			<Skeleton className="h-4 w-24" />
		</div>
	);
};

export async function ProjectSwitcher({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string | null;
	projectSlug: string | null;
}) {
	if (!projectSlug || !organizationSlug) {
		return null;
	}

	const serviceContext = await createNextServiceContext();

	const userPromise = getUser({
		ctx: serviceContext,
	});

	const activeOrganizationPromise = getOrganizationBySlug({
		ctx: serviceContext,
		input: {
			slug: organizationSlug,
		},
	});

	const projectPromisePromise = getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: {
			organizationSlug: organizationSlug,
			projectSlug: projectSlug,
		},
	});

	const [userResult, activeOrganizationResult, activeProjectResult] =
		await Promise.all([
			userPromise,
			activeOrganizationPromise,
			projectPromisePromise,
		]);

	if (
		userResult.isErr() ||
		activeOrganizationResult.isErr() ||
		activeProjectResult.isErr()
	) {
		return null;
	}

	const user = userResult.value;
	const activeOrganization = activeOrganizationResult.value;
	const activeProject = activeProjectResult.value;

	return (
		<>
			<NavSlashSeparator />
			<div className="flex items-center gap-2">
				<Link href={`/${organizationSlug}/${projectSlug}`}>
					<div className="flex items-center gap-2">
						<Suspense fallback={<ProjectTitleSkeleton />}>
							<ProjectTitle project={activeProject} />
						</Suspense>
					</div>
				</Link>
				<OrganizationProjectSwitcher
					user={user}
					activeOrganization={activeOrganization}
					activeProject={activeProject}
				/>
			</div>
		</>
	);
}
