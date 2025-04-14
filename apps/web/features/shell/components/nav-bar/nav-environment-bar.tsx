import { getEnvironment } from "@/lib/environments/utils";
import { getProjectBySlug } from "@/lib/queries/cached-queries";
import { Suspense } from "react";

export async function EnviromentBarContent({
	organizationSlug,
	projectSlug,
}: { organizationSlug: string | null; projectSlug: string | null }) {
	if (!organizationSlug || !projectSlug) {
		return null;
	}
	const [environment, project] = await Promise.all([
		getEnvironment(organizationSlug, projectSlug),
		getProjectBySlug(projectSlug),
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
