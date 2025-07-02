import { Card } from "@voidhash/ui";
import { ApiKeyRecord } from "./api-key-record";
import { CreateSecretKeyModalButton } from "./create-secret-key-modal-button";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { ApiKeyService } from "@/lib/services/api-keys/api-key.service";
import { Effect, pipe } from "effect";
import { ProjectService } from "@/lib/services/projects/project.service";
import { NotFoundError } from "@/lib/effect/errors";

export async function ProjectApiKeysPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
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

	const { project } = data.value;

	const apiKeysResult = await runServerEffect(
			pipe(
				ApiKeyService,
				Effect.flatMap((apiKeyService) => apiKeyService.getApiKeys(project.id))
			)
		)
	
	
	if (apiKeysResult.isErr()) {
		return <VoidhashErrorCard error={apiKeysResult._unsafeUnwrapErr()} />;
	}

	const apiKeys = apiKeysResult.value;

	return (
		<div>
			<div className="flex flex-row items-center justify-between pt-6">
				<div>
					<h2 className="text-xl font-normal tracking-right">API Keys</h2>
					<p className="text-muted-foreground mt-1">Manage your API keys</p>
				</div>
				<CreateSecretKeyModalButton projectId={project.id} />
			</div>

			<div className="mt-8">
				<Card className="divide-y grid p-0 gap-0">
					{apiKeys.map((apiKey) => (
						<ApiKeyRecord key={apiKey.id} apiKey={apiKey} />
					))}
				</Card>
			</div>
		</div>
	);
}
