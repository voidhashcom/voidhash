import { NavProjectEnvironmentToggle } from "./nav-project-environment-toggle";
import { Suspense } from "react";
import { Effect } from "effect";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { ProjectService } from "@/lib/services/projects/project.service";
import { NotFoundError } from "@/lib/effect/errors";
import { Environment } from "@/lib/effect/environment";

export async function NavProjectEnvironmentContent({
	organizationSlug,
	projectSlug,
}: { organizationSlug: string | null; projectSlug: string | null }) {
	if (!organizationSlug || !projectSlug) {
		return null;
	}
	const data = await runServerEffect(Environment.withEnvironment({
		organizationSlug,
		projectSlug,
	})(Effect.gen(function* () {
		const projectService = yield* ProjectService;
		const environment = yield* Environment
		const project = yield* projectService.getProjectBySlugAndOrganizationSlug({
			organizationSlug,
			projectSlug,
		});
		if (!project) {
			return yield* Effect.fail(new NotFoundError({
				message: "Project not found",
			}));
		}
		return { project, environment };
	})));


	if (data.isErr()) {
		return null;
	}

	const { project, environment } = data.value;

	return (
		<div>
			<NavProjectEnvironmentToggle
				environment={environment ?? "testing"}
				projectId={project.id}
			/>
		</div>
	);
}

export async function NavProjectEnvironment({
	organizationSlug,
	projectSlug,
}: { organizationSlug: string | null; projectSlug: string | null }) {
	return (
		<Suspense fallback={<div></div>}>
			<NavProjectEnvironmentContent
				organizationSlug={organizationSlug}
				projectSlug={projectSlug}
			/>
		</Suspense>
	);
}
