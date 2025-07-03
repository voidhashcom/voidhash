import { Suspense } from "react";
import { cn } from "@voidhash/ui";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { Environment } from "@/lib/effect/environment";
import { ProjectService } from "@/lib/services/projects/project.service";
import { Effect } from "effect";
import { NotFoundError } from "@/lib/effect/errors";
import { AuthSession } from "@/lib/effect/auth";
import { Environment as EnvironmentEnum } from "@voidhash/lib/index";

export async function EnviromentBarContent({
	organizationSlug,
	projectSlug,
}: { organizationSlug: string | null; projectSlug: string | null }) {
	if (!organizationSlug || !projectSlug) {
		return null;
	}

	const data = await runServerEffect(
		AuthSession.withAuthSession()(
			Environment.withEnvironment({
				organizationSlug,
				projectSlug,
			})(
				Effect.gen(function* () {
					const projectService = yield* ProjectService;
					const environment = yield* Environment;
					const project =
						yield* projectService.getProjectBySlugAndOrganizationSlug({
							organizationSlug,
							projectSlug,
						});
					if (!project) {
						return yield* Effect.fail(
							new NotFoundError({
								message: "Project not found",
							})
						);
					}
					return { project, environment };
				})
			)
		)
	);

	if (data.isErr()) {
		return null;
	}

	const { project, environment } = data.value;

	const showBar =
		project && environment && environment === EnvironmentEnum.Testing;

	return (
		<div
			className={cn(
				"flex-1 w-full bg-primary flex-shrink-0 text-white flex text-center items-center justify-center font-semibold transition-all text-sm duration-75",
				showBar ? "h-[41px] opacity-100" : "h-0 opacity-0"
			)}
		>
			{
				// Marker to update layout if bar is visible
				showBar && <div id="nav-enviromental-bar" className="display-none" />
			}
			You are in development mode. Displaying test data.
		</div>
	);
}

export async function EnviromentBar({
	organizationSlug,
	projectSlug,
}: { organizationSlug: string | null; projectSlug: string | null }) {
	return (
		<Suspense fallback={<div></div>}>
			<EnviromentBarContent
				organizationSlug={organizationSlug}
				projectSlug={projectSlug}
			/>
		</Suspense>
	);
}
