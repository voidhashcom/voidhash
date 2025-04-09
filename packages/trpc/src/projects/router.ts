import { createId, createSlug } from "@voidhash/lib";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import {
	createProjectSchema,
	deleteProjectSchema,
	getTeamsProjectsBySlugSchema,
	updateProjectSchema,
} from "./schema";
import { db, organization, projects } from "@voidhash/db";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";

export const projectsRouter = createTRPCRouter({
	create: protectedProcedure
		.input(createProjectSchema)
		.mutation(async ({ ctx, input }) => {
			const id = createId();
			let slug = createSlug(input.name);

			const existingProject = await db.query.projects.findFirst({
				where: and(
					eq(projects.slug, slug),
					eq(projects.organizationId, input.organizationId)
				),
			});

			if (existingProject) {
				slug = slug + "-" + randomUUID();
			}

			await db.insert(projects).values({
				id,
				name: input.name,
				slug,
				organizationId: input.organizationId,
				createdByUserId: ctx.session.user.id,
			});

			return {
				id,
				name,
				slug,
			};
		}),

	getTeamsProjectsBySlug: protectedProcedure
		.input(getTeamsProjectsBySlugSchema)
		.query(async ({ ctx, input }) => {
			const teamProjects = await db
				.select()
				.from(projects)
				.innerJoin(organization, eq(projects.organizationId, organization.id))
				.where(eq(organization.slug, input.organizationSlug));

			return teamProjects.map((project) => project.projects);
		}),

	update: protectedProcedure
		.input(updateProjectSchema)
		.mutation(async ({ ctx, input }) => {
			await db
				.update(projects)
				.set({
					name: input.name,
				})
				.where(eq(projects.id, input.projectId));
		}),

	delete: protectedProcedure
		.input(deleteProjectSchema)
		.mutation(async ({ ctx, input }) => {
			await db.delete(projects).where(eq(projects.id, input.projectId));
		}),
});
