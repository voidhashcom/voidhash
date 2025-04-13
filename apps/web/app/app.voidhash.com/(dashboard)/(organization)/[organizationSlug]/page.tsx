import { ProjectsPage } from "@/features/organizations/projects/projects-page";

export default async function RouteComponent({
	params,
}: {
	params: Promise<{
		organizationSlug: string;
	}>;
}) {
	const { organizationSlug } = await params;

	return <ProjectsPage params={{ organizationSlug }} />;
}
