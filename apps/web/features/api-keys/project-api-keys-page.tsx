import { Card } from "@voidhash/ui";
import { ApiKeyRecord } from "./api-key-record";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { getEnvironment } from "@/lib/services/environments/utils";
import { CreateSecretKeyModalButton } from "./create-secret-key-modal-button";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { tryCatch } from "@/lib/try-catch";
import { NextjsRuntime } from "@/lib/effect/runtimes/nextjs";
import { ApiKeyService } from "@/lib/services/api-keys/api-key-service";
import { Effect, pipe } from "effect";

export async function ProjectApiKeysPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const serviceContext = await createNextServiceContext();
	const [projectResult, environmentResult] = await Promise.all([
		getProjectBySlugAndOrganizationSlug({
			ctx: serviceContext,
			input: {
				organizationSlug: organizationSlug,
				projectSlug: projectSlug,
			},
		}),
		getEnvironment(serviceContext.cookies, organizationSlug, projectSlug),
	]);

	if (projectResult.isErr()) {
		const error = projectResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const project = projectResult.value;

	if (environmentResult.isErr()) {
		const error = environmentResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const apiKeysResult = await tryCatch(
		NextjsRuntime.runPromise(
			pipe(
				ApiKeyService,
				Effect.flatMap((apiKeyService) => apiKeyService.getApiKeys(project.id))
			)
		)
	);
	
	if (apiKeysResult.error) {
		return <VoidhashErrorCard error={apiKeysResult.error} />;
	}

	const apiKeys = apiKeysResult.data;

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
