import { Page } from "@/features/shell";
import { Card } from "@voidhash/ui";
import { ApiKeyRecord } from "./api-key-record";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { notFound } from "next/navigation";
import { getEnvironment } from "@/lib/environments/utils";
import { CreateSecretKeyModalButton } from "./create-secret-key-modal-button";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { getApiKeys } from "@/lib/services/api-keys/queries";

export async function ProjectApiKeysPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const serviceContext = await createNextServiceContext();
	const [project, environment] = await Promise.all([
		getProjectBySlugAndOrganizationSlug({
			ctx: serviceContext,
			input: {
				organizationSlug: organizationSlug,
				projectSlug: projectSlug,
			},
		}),
		getEnvironment(serviceContext.cookies, organizationSlug, projectSlug),
	]);

	if (!project) {
		return notFound();
	}

	if (!environment) {
		throw new Error("Environment not found");
	}

	const apiKeys = await getApiKeys({
		ctx: serviceContext,
		input: {
			projectId: project.id,
			environment,
		},
	});

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">API Keys</h1>
					<CreateSecretKeyModalButton projectId={project.id} />
				</div>
				<p className="text-muted-foreground mt-3">Manage your API keys</p>
				<div className="mt-8">
					<Card className="divide-y grid p-0 gap-0">
						{apiKeys.map((apiKey) => (
							<ApiKeyRecord key={apiKey.id} apiKey={apiKey} />
						))}
					</Card>
				</div>
			</div>
		</Page>
	);
}
