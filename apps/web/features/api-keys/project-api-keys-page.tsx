import { Card } from "@voidhash/ui";
import { ApiKeyRecord } from "./api-key-record";
import { CreateSecretKeyModalButton } from "./create-secret-key-modal-button";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { ApiKeyService } from "@/lib/services/api-key.service";
import { Effect } from "effect";
import { ProjectService } from "@/lib/services/project.service";
import { NotFoundError } from "@/lib/effect/errors";
import { AuthService, AuthSession } from "@/lib/services/auth.service";
import {
	Environment,
	EnvironmentService,
} from "@/lib/services/environment.service";

export async function ProjectApiKeysPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const data = await runServerEffect(
		Effect.gen(function* () {
			const authService = yield* AuthService;
			const environmentService = yield* EnvironmentService;
			const apiKeyService = yield* ApiKeyService;
			const authSession = yield* authService.authenticateWithSession();
			return yield* AuthSession.provide(authSession)(
				Effect.gen(function* () {
					const environment =
						yield* environmentService.getEnvironmentFromCookie({
							organizationSlug,
							projectSlug,
						});
					return yield* Environment.provide(environment)(
						Effect.gen(function* () {
							const projectService = yield* ProjectService;
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
							const apiKeys = yield* apiKeyService.getApiKeys(project.id);

							return { project, apiKeys };
						})
					);
				})
			);
		})
	);

	if (data.isErr()) {
		const error = data._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const { project, apiKeys } = data.value;

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
