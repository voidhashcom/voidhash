import { getEnvironment } from "@/lib/services/environments/utils";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { getOrganizationBySlug } from "@/lib/services/organizations/queries";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { Suspense } from "react";

export async function EnviromentBarContent({
	organizationSlug,
	projectSlug,
}: { organizationSlug: string | null; projectSlug: string | null }) {
	if (!organizationSlug || !projectSlug) {
		return null;
	}
	const serviceContext = await createNextServiceContext();
	const organization = await getOrganizationBySlug({
		ctx: serviceContext,
		input: {
			slug: organizationSlug,
		},
	});
	if (!organization) {
		return null;
	}
	const [environment, project] = await Promise.all([
		getEnvironment(serviceContext.cookies, organizationSlug, projectSlug),
		getProjectBySlugAndOrganizationSlug({
			ctx: serviceContext,
			input: {
				organizationSlug: organizationSlug,
				projectSlug: projectSlug,
			},
		}),
	]);

	if (!project || !environment || environment !== "testing") {
		return null;
	}

	return (
		<div className="absolute top-0 left-0 right-0 h-0.5 w-full bg-orange-600"></div>
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
