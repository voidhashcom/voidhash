import { ProjectApiKeysPage } from "@/features/projects/settings/api-keys/project-api-keys-page";

export default async function Page({
	params,
}: { params: Promise<{ organizationSlug: string; projectSlug: string }> }) {
	const { projectSlug } = await params;

	return <ProjectApiKeysPage projectSlug={projectSlug} />;
}
