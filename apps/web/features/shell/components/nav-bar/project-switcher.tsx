import { GradientAvatar, Skeleton } from "@voidhash/ui";
import Link from "next/link";
import { NavSlashSeparator } from "./nav-slash-separator";
import { OrganizationProjectSwitcher } from "./organization-project-switcher";
import { Suspense } from "react";
import { Project } from "@voidhash/db";
import { UserService } from "@/lib/services/user.service";
import { Effect } from "effect";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { OrganizationService } from "@/lib/services/organization.service";
import { ProjectService } from "@/lib/services/project.service";
import { NotFoundError } from "@/lib/effect/errors";
import { AuthService, AuthSession } from "@/lib/services/auth.service";

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

	const data = await runServerEffect(
		Effect.gen(function* () {
			const authService = yield* AuthService;
			const authSession = yield* authService.authenticateWithSession();
			return yield* AuthSession.provide(authSession)(
				Effect.gen(function* () {
					const userService = yield* UserService;
					const organizationService = yield* OrganizationService;
					const projectService = yield* ProjectService;
					const [user, activeOrganization, activeProject] = yield* Effect.all([
						userService.getUser(),
						organizationService.getOrganizationBySlug(organizationSlug),
						projectService.getProjectBySlugAndOrganizationSlug({
							organizationSlug,
							projectSlug,
						}),
					], {
						concurrency: "unbounded"
					});
					if (!activeOrganization) {
						return yield* Effect.fail(
							new NotFoundError({
								message: "Organization not found",
							})
						);
					}
					if (!activeProject) {
						return yield* Effect.fail(
							new NotFoundError({
								message: "Project not found",
							})
						);
					}
					return { user, activeOrganization, activeProject };
				})
			);
		})
	);

	if (data.isErr()) {
		return null;
	}

	const { user, activeOrganization, activeProject } = data.value;

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
