import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getTeamsProjectsBySlugSchema } from "./schema";
import { db, organization, projects } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const projectsRouter = createTRPCRouter({
	getTeamsProjectsBySlug: protectedProcedure
		.input(getTeamsProjectsBySlugSchema)
		.query(async ({ input }) => {
			const teamProjects = await db
				.select()
				.from(projects)
				.innerJoin(organization, eq(projects.organizationId, organization.id))
				.where(eq(organization.slug, input.organizationSlug));

			return teamProjects.map((project) => project.projects);
		}),
});
