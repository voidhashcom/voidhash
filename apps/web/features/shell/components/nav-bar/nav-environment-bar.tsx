import { getEnvironment } from "@/lib/services/environments/utils";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { getOrganizationBySlug } from "@/lib/services/organizations/queries";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { Suspense } from "react";
import { cn } from "@voidhash/ui";

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
	const [environmentResult, projectResult] = await Promise.all([
		getEnvironment(serviceContext.cookies, organizationSlug, projectSlug),
		getProjectBySlugAndOrganizationSlug({
			ctx: serviceContext,
			input: {
				organizationSlug: organizationSlug,
				projectSlug: projectSlug,
			},
		}),
	]);

	if (projectResult.isErr() || environmentResult.isErr()) {
		return null;
	}

	const project = projectResult.value;
	const environment = environmentResult.value;

	const showBar = project && environment && environment === "testing";

	return (
		<div
			className={cn(
				"flex-1 w-full bg-primary flex-shrink-0 text-white flex text-center items-center justify-center font-semibold transition-all duration-300",
				showBar ? "h-[41px] opacity-100" : "h-0 opacity-0"
			)}
		>
			{
				// Marker to update layout if bar is visible
				showBar && <div id="nav-enviromental-bar" className="display-none" />
			}
			You are in development mode.
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
