import { db, organization, projects } from "@voidhash/db";
import { eq } from "drizzle-orm";

export async function getTeamsProjectsBySlug({
	organizationSlug,
}: {
	organizationSlug: string;
}) {
	// TODO: Auth
	const teamProjects = await db
		.select()
		.from(projects)
		.innerJoin(organization, eq(projects.organizationId, organization.id))
		.where(eq(organization.slug, organizationSlug));

	return teamProjects.map((project) => project.projects);
}
