import { GradientAvatar, Skeleton } from "@voidhash/ui";
import Link from "next/link";
import { NavSlashSeparator } from "./nav-slash-separator";
import { OrganizationProjectSwitcher } from "./organization-project-switcher";
import {
	type getProjectBySlug,
	getProjectBySlugAndOrganizationSlug,
} from "@/lib/services/projects/queries";
import { Suspense } from "react";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { getOrganizationBySlug } from "@/lib/services/organizations/queries";
import { getUser } from "@/lib/services/users/queries";

const ProjectTitle = async ({
	projectPromise,
}: { projectPromise: ReturnType<typeof getProjectBySlug> }) => {
	const project = await projectPromise;

	if (!project) {
		return null;
	}

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

	const projectPromise = getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: {
			organizationSlug: organizationSlug,
			projectSlug: projectSlug,
		},
	});

	return (
		<>
			<NavSlashSeparator />
			<div className="flex items-center gap-2">
				<Link href={`/${organizationSlug}/${projectSlug}`}>
					<div className="flex items-center gap-2">
						<Suspense fallback={<ProjectTitleSkeleton />}>
							<ProjectTitle projectPromise={projectPromise} />
						</Suspense>
					</div>
				</Link>
				<OrganizationProjectSwitcher
					userPromise={userPromise}
					activeOrganizationPromise={activeOrganizationPromise}
					activeProjectPromise={projectPromise}
				/>
			</div>
		</>
	);
}
