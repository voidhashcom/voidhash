import { Page } from "@/features/shell";
import { VoidhashErrorCard } from "../shell/components/voidhash-error-card";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { Effect } from "effect";
import { NotFoundError } from "@/lib/effect/errors";
import { ProjectService } from "@/lib/services/project.service";
export async function DevelopersPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug;
}) {
	const data = await runServerEffect(Effect.gen(function* () {
		const projectService = yield* ProjectService;
		const project = yield* projectService.getProjectBySlugAndOrganizationSlug({
			organizationSlug,
			projectSlug,
		});
		if (!project) {
			return yield* Effect.fail(new NotFoundError({
				message: "Project not found",
			}));
		}
		return { project };
	}));

	if (data.isErr()) {
		const error = data._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const {  } = data.value;

	return <Page>
		<div className="max-w-4xl mx-auto">
			<h1 className="text-3xl font-normal tracking-right">Developers</h1>
		</div>
	</Page>;
}
